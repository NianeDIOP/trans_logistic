/**
 * Accès aux référentiels des Paramètres.
 *
 * Règle d'intégrité : une donnée déjà utilisée par une facture n'est jamais supprimée,
 * elle est désactivée (`actif = 0`) et disparaît des listes de saisie.
 */
import {
  codeDepuisLibelle,
  validerClient,
  validerEntreprise,
  validerPrestation,
  validerZone,
  type Erreurs
} from '../../core/parametres'
import type { Entreprise } from '../../shared/types'
import type {
  Client,
  ClientSaisie,
  ElementListe,
  EntrepriseSaisie,
  NomListe,
  Prestation,
  PrestationSaisie,
  ResultatSuppression,
  TypeImage,
  Zone,
  ZoneSaisie
} from '../../shared/parametres'
import { MODELES_FACTURE, THEMES_FACTURE } from '../../shared/modeles'
import type { SqlDatabase } from './migrations'

/** Erreur de saisie : message général et, le cas échéant, erreurs par champ. */
export class ErreurValidation extends Error {
  constructor(
    message: string,
    public readonly erreurs: Record<string, string> = {}
  ) {
    super(message)
    this.name = 'ErreurValidation'
  }
}

function verifier<T>(
  r: { ok: true; valeur: T } | { ok: false; erreurs: Erreurs<T> }
): T {
  if (!r.ok) {
    throw new ErreurValidation('Certains champs sont invalides.', r.erreurs as Record<string, string>)
  }
  return r.valeur
}

function transaction<T>(db: SqlDatabase, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

function dernierId(resultat: unknown): number {
  return Number((resultat as { lastInsertRowid: number | bigint }).lastInsertRowid)
}

function compter(db: SqlDatabase, sql: string, ...params: unknown[]): number {
  return Number((db.prepare(sql).get(...params) as { n: number }).n)
}

/* ---------------------------------------------------------------- Entreprise */

export function lireEntreprise(db: SqlDatabase): Entreprise {
  const e = db.prepare('SELECT * FROM entreprise WHERE id = 1').get() as Entreprise | undefined
  if (!e) throw new Error("Paramètres de l'entreprise introuvables")
  return e
}

export function modifierEntreprise(db: SqlDatabase, saisie: EntrepriseSaisie): Entreprise {
  const v = verifier(validerEntreprise(saisie))
  db.prepare(
    `UPDATE entreprise SET raison_sociale = ?, rc = ?, ninea = ?, banque = ?, iban = ?, siege = ?,
       adresse = ?, email = ?, tel = ?, taux_tva = ?, prefixe_facture = ?, mentions = ?
     WHERE id = 1`
  ).run(
    v.raison_sociale, v.rc, v.ninea, v.banque, v.iban, v.siege,
    v.adresse, v.email, v.tel, v.taux_tva, v.prefixe_facture, v.mentions
  )
  return lireEntreprise(db)
}

export function definirImage(db: SqlDatabase, type: TypeImage, chemin: string | null): void {
  const colonne = type === 'logo' ? 'logo_path' : 'cachet_path'
  db.prepare(`UPDATE entreprise SET ${colonne} = ? WHERE id = 1`).run(chemin)
}

/* ------------------------------------------------------------------- Clients */

interface LigneClient extends Omit<Client, 'actif'> {
  actif: number
}

const versClient = (r: LigneClient): Client => ({ ...r, actif: r.actif === 1 })

export function listerClients(
  db: SqlDatabase,
  options: { recherche?: string; inclureInactifs?: boolean } = {}
): Client[] {
  const motif = `%${(options.recherche ?? '').trim()}%`
  const rows = db
    .prepare(
      `SELECT id, raison_sociale, adresse, ninea, tel, email, actif, cree_le FROM clients
       WHERE (? = 1 OR actif = 1)
         AND (raison_sociale LIKE ? OR ninea LIKE ? OR tel LIKE ? OR email LIKE ?)
       ORDER BY actif DESC, raison_sociale COLLATE NOCASE`
    )
    .all(options.inclureInactifs ? 1 : 0, motif, motif, motif, motif) as LigneClient[]
  return rows.map(versClient)
}

function clientParId(db: SqlDatabase, id: number): Client {
  const r = db
    .prepare('SELECT id, raison_sociale, adresse, ninea, tel, email, actif, cree_le FROM clients WHERE id = ?')
    .get(id) as LigneClient | undefined
  if (!r) throw new Error('Client introuvable')
  return versClient(r)
}

function verifierDoublonClient(db: SqlDatabase, nom: string, sauf: number | null): void {
  const n = compter(
    db,
    'SELECT COUNT(*) AS n FROM clients WHERE raison_sociale = ? COLLATE NOCASE AND id IS NOT ?',
    nom,
    sauf
  )
  if (n > 0) {
    throw new ErreurValidation('Ce client existe déjà.', {
      raison_sociale: 'Un client porte déjà ce nom.'
    })
  }
}

export function creerClient(db: SqlDatabase, saisie: ClientSaisie): Client {
  const v = verifier(validerClient(saisie))
  verifierDoublonClient(db, v.raison_sociale, null)
  const r = db
    .prepare('INSERT INTO clients (raison_sociale, adresse, ninea, tel, email) VALUES (?, ?, ?, ?, ?)')
    .run(v.raison_sociale, v.adresse, v.ninea, v.tel, v.email)
  return clientParId(db, dernierId(r))
}

export function modifierClient(db: SqlDatabase, id: number, saisie: ClientSaisie): Client {
  const v = verifier(validerClient(saisie))
  clientParId(db, id)
  verifierDoublonClient(db, v.raison_sociale, id)
  db.prepare(
    'UPDATE clients SET raison_sociale = ?, adresse = ?, ninea = ?, tel = ?, email = ? WHERE id = ?'
  ).run(v.raison_sociale, v.adresse, v.ninea, v.tel, v.email, id)
  return clientParId(db, id)
}

export function supprimerClient(db: SqlDatabase, id: number): ResultatSuppression {
  clientParId(db, id)
  if (compter(db, 'SELECT COUNT(*) AS n FROM factures WHERE client_id = ?', id) > 0) {
    db.prepare('UPDATE clients SET actif = 0 WHERE id = ?').run(id)
    return 'desactive'
  }
  db.prepare('DELETE FROM clients WHERE id = ?').run(id)
  return 'supprime'
}

export function reactiverClient(db: SqlDatabase, id: number): void {
  db.prepare('UPDATE clients SET actif = 1 WHERE id = ?').run(id)
}

/* ------------------------------------------------------------ Zones et tarifs */

export function listerZones(db: SqlDatabase, inclureInactifs = false): Zone[] {
  const rows = db
    .prepare(
      `SELECT zone, type_conteneur, prix, actif FROM zones_tarifs
       WHERE (? = 1 OR actif = 1) ORDER BY zone COLLATE NOCASE`
    )
    .all(inclureInactifs ? 1 : 0) as { zone: string; type_conteneur: string; prix: number; actif: number }[]
  const zones = new Map<string, Zone>()
  for (const r of rows) {
    const z = zones.get(r.zone) ?? { zone: r.zone, actif: r.actif === 1, prix: {} }
    z.prix[r.type_conteneur] = r.prix
    z.actif = z.actif || r.actif === 1
    zones.set(r.zone, z)
  }
  return [...zones.values()]
}

/**
 * Crée (`ancienNom = null`) ou modifie une zone et ses prix.
 * Un prix `null` retire le type de conteneur de la zone (les factures existantes gardent leur copie).
 */
export function enregistrerZone(db: SqlDatabase, ancienNom: string | null, saisie: ZoneSaisie): Zone {
  const v = verifier(validerZone(saisie))
  return transaction(db, () => {
    const collision = compter(
      db,
      'SELECT COUNT(*) AS n FROM zones_tarifs WHERE zone = ? COLLATE NOCASE AND zone IS NOT ?',
      v.zone,
      ancienNom
    )
    if (collision > 0) {
      throw new ErreurValidation('Cette zone existe déjà.', { zone: 'Une zone porte déjà ce nom.' })
    }
    if (ancienNom !== null) {
      db.prepare('UPDATE zones_tarifs SET zone = ? WHERE zone = ?').run(v.zone, ancienNom)
    }
    for (const [type, prix] of Object.entries(v.prix)) {
      if (prix === null) {
        db.prepare('DELETE FROM zones_tarifs WHERE zone = ? AND type_conteneur = ?').run(v.zone, type)
      } else {
        db.prepare(
          `INSERT INTO zones_tarifs (zone, type_conteneur, prix) VALUES (?, ?, ?)
           ON CONFLICT (zone, type_conteneur) DO UPDATE SET prix = excluded.prix`
        ).run(v.zone, type, prix)
      }
    }
    const zone = listerZones(db, true).find((z) => z.zone === v.zone)
    if (!zone) throw new Error('Zone introuvable après enregistrement')
    return zone
  })
}

export function supprimerZone(db: SqlDatabase, nom: string): ResultatSuppression {
  if (compter(db, 'SELECT COUNT(*) AS n FROM lignes WHERE zone = ?', nom) > 0) {
    db.prepare('UPDATE zones_tarifs SET actif = 0 WHERE zone = ?').run(nom)
    return 'desactive'
  }
  db.prepare('DELETE FROM zones_tarifs WHERE zone = ?').run(nom)
  return 'supprime'
}

export function reactiverZone(db: SqlDatabase, nom: string): void {
  db.prepare('UPDATE zones_tarifs SET actif = 1 WHERE zone = ?').run(nom)
}

/* --------------------------------------------------------------- Prestations */

interface LignePrestation extends Omit<Prestation, 'actif' | 'soumis_tva' | 'par_conteneur' | 'automatique'> {
  actif: number
  soumis_tva: number
  par_conteneur: number
  automatique: number
}

const versPrestation = (r: LignePrestation): Prestation => ({
  ...r,
  actif: r.actif === 1,
  soumis_tva: r.soumis_tva === 1,
  par_conteneur: r.par_conteneur === 1,
  automatique: r.automatique === 1
})

const COLONNES_PRESTATION = 'id, libelle, prix, soumis_tva, par_conteneur, automatique, actif, ordre'

export function listerPrestations(db: SqlDatabase, inclureInactifs = false): Prestation[] {
  const rows = db
    .prepare(
      `SELECT ${COLONNES_PRESTATION} FROM prestations
       WHERE (? = 1 OR actif = 1) ORDER BY actif DESC, ordre, id`
    )
    .all(inclureInactifs ? 1 : 0) as LignePrestation[]
  return rows.map(versPrestation)
}

function prestationParId(db: SqlDatabase, id: number): Prestation {
  const r = db
    .prepare(`SELECT ${COLONNES_PRESTATION} FROM prestations WHERE id = ?`)
    .get(id) as LignePrestation | undefined
  if (!r) throw new Error('Prestation introuvable')
  return versPrestation(r)
}

function verifierDoublonPrestation(db: SqlDatabase, libelle: string, sauf: number | null): void {
  if (
    compter(
      db,
      'SELECT COUNT(*) AS n FROM prestations WHERE libelle = ? COLLATE NOCASE AND id IS NOT ?',
      libelle,
      sauf
    ) > 0
  ) {
    throw new ErreurValidation('Cette prestation existe déjà.', {
      libelle: 'Une prestation porte déjà ce libellé.'
    })
  }
}

export function creerPrestation(db: SqlDatabase, saisie: PrestationSaisie): Prestation {
  const v = verifier(validerPrestation(saisie))
  verifierDoublonPrestation(db, v.libelle, null)
  const r = db
    .prepare(
      `INSERT INTO prestations (libelle, prix, soumis_tva, par_conteneur, automatique, ordre)
       VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(ordre), 0) + 1 FROM prestations))`
    )
    .run(v.libelle, v.prix, v.soumis_tva ? 1 : 0, v.par_conteneur ? 1 : 0, v.automatique ? 1 : 0)
  return prestationParId(db, dernierId(r))
}

export function modifierPrestation(db: SqlDatabase, id: number, saisie: PrestationSaisie): Prestation {
  const v = verifier(validerPrestation(saisie))
  prestationParId(db, id)
  verifierDoublonPrestation(db, v.libelle, id)
  db.prepare(
    'UPDATE prestations SET libelle = ?, prix = ?, soumis_tva = ?, par_conteneur = ?, automatique = ? WHERE id = ?'
  ).run(v.libelle, v.prix, v.soumis_tva ? 1 : 0, v.par_conteneur ? 1 : 0, v.automatique ? 1 : 0, id)
  return prestationParId(db, id)
}

export function supprimerPrestation(db: SqlDatabase, id: number): ResultatSuppression {
  const p = prestationParId(db, id)
  if (
    compter(db, 'SELECT COUNT(*) AS n FROM lignes WHERE prestation_id = ? OR designation = ?', id, p.libelle) > 0
  ) {
    db.prepare('UPDATE prestations SET actif = 0 WHERE id = ?').run(id)
    return 'desactive'
  }
  db.prepare('DELETE FROM prestations WHERE id = ?').run(id)
  return 'supprime'
}

export function reactiverPrestation(db: SqlDatabase, id: number): void {
  db.prepare('UPDATE prestations SET actif = 1 WHERE id = ?').run(id)
}

/* ---------------------------------------------------------------- Listes */

const LISTES: Record<NomListe, { usage: string }> = {
  types_conteneurs: {
    usage:
      'SELECT (SELECT COUNT(*) FROM lignes WHERE type_conteneur = ?1) + ' +
      '(SELECT COUNT(*) FROM zones_tarifs WHERE type_conteneur = ?1) AS n'
  },
  natures: { usage: 'SELECT COUNT(*) AS n FROM lignes WHERE nature = ?1' },
  modes_paiement: { usage: 'SELECT COUNT(*) AS n FROM paiements WHERE mode = ?1' }
}

function nomListe(nom: NomListe): NomListe {
  if (!(nom in LISTES)) throw new Error(`Liste inconnue : ${nom}`)
  return nom
}

interface LigneListe extends Omit<ElementListe, 'actif'> {
  actif: number
}

export function listerListe(db: SqlDatabase, nom: NomListe, inclureInactifs = false): ElementListe[] {
  const rows = db
    .prepare(
      `SELECT id, code, libelle, actif, ordre FROM ${nomListe(nom)}
       WHERE (? = 1 OR actif = 1) ORDER BY actif DESC, ordre, id`
    )
    .all(inclureInactifs ? 1 : 0) as LigneListe[]
  return rows.map((r) => ({ ...r, actif: r.actif === 1 }))
}

function elementParId(db: SqlDatabase, nom: NomListe, id: number): ElementListe {
  const r = db
    .prepare(`SELECT id, code, libelle, actif, ordre FROM ${nomListe(nom)} WHERE id = ?`)
    .get(id) as LigneListe | undefined
  if (!r) throw new Error('Élément introuvable')
  return { ...r, actif: r.actif === 1 }
}

function verifierLibelle(db: SqlDatabase, nom: NomListe, libelle: string, sauf: number | null): string {
  const v = libelle.trim().replace(/\s+/g, ' ')
  if (!v || !codeDepuisLibelle(v)) {
    throw new ErreurValidation('Le libellé est obligatoire.', { libelle: 'Le libellé est obligatoire.' })
  }
  if (
    compter(
      db,
      `SELECT COUNT(*) AS n FROM ${nom} WHERE libelle = ? COLLATE NOCASE AND id IS NOT ?`,
      v,
      sauf
    ) > 0
  ) {
    throw new ErreurValidation('Cet élément existe déjà.', { libelle: 'Ce libellé existe déjà.' })
  }
  return v
}

/** Ajoute un élément. Son code technique est dérivé du libellé et ne change plus ensuite. */
export function ajouterElement(db: SqlDatabase, nom: NomListe, libelle: string): ElementListe {
  const v = verifierLibelle(db, nomListe(nom), libelle, null)
  const base = codeDepuisLibelle(v)
  let code = base
  for (let i = 2; compter(db, `SELECT COUNT(*) AS n FROM ${nom} WHERE code = ?`, code) > 0; i++) {
    code = `${base}_${i}`
  }
  const r = db
    .prepare(
      `INSERT INTO ${nom} (code, libelle, ordre)
       VALUES (?, ?, (SELECT COALESCE(MAX(ordre), 0) + 1 FROM ${nom}))`
    )
    .run(code, v)
  return elementParId(db, nom, dernierId(r))
}

export function renommerElement(db: SqlDatabase, nom: NomListe, id: number, libelle: string): ElementListe {
  elementParId(db, nomListe(nom), id)
  const v = verifierLibelle(db, nom, libelle, id)
  db.prepare(`UPDATE ${nom} SET libelle = ? WHERE id = ?`).run(v, id)
  return elementParId(db, nom, id)
}

export function supprimerElement(db: SqlDatabase, nom: NomListe, id: number): ResultatSuppression {
  const e = elementParId(db, nomListe(nom), id)
  if (compter(db, LISTES[nom].usage, e.code) > 0) {
    db.prepare(`UPDATE ${nom} SET actif = 0 WHERE id = ?`).run(id)
    return 'desactive'
  }
  db.prepare(`DELETE FROM ${nom} WHERE id = ?`).run(id)
  return 'supprime'
}

export function reactiverElement(db: SqlDatabase, nom: NomListe, id: number): void {
  db.prepare(`UPDATE ${nomListe(nom)} SET actif = 1 WHERE id = ?`).run(id)
}

/* ------------------------------------------------- Modèle et thème des factures */

export function definirPresentation(db: SqlDatabase, modele: string, theme: string): Entreprise {
  if (!MODELES_FACTURE.some((m) => m.id === modele)) throw new ErreurValidation('Modèle de facture inconnu.')
  if (!THEMES_FACTURE.some((t) => t.id === theme)) throw new ErreurValidation('Thème de couleurs inconnu.')
  db.prepare('UPDATE entreprise SET modele_facture = ?, theme_facture = ? WHERE id = 1').run(modele, theme)
  return lireEntreprise(db)
}
