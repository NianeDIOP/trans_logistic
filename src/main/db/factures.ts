/**
 * Factures : brouillons, lecture et validation.
 * Une facture validée n'est jamais modifiée ni supprimée.
 */
import { ligneVide, verifierFacture, type ErreursFacture } from '../../core/facture'
import { calculerTotaux } from '../../core/tva'
import type { Facture, FactureSaisie, Ligne, Referentiels } from '../../shared/factures'
import { rafraichirInstantanes } from './instantanes'
import type { SqlDatabase } from './migrations'
import { validerFacture } from './numerotation'
import {
  ErreurValidation,
  lireEntreprise,
  listerClients,
  listerListe,
  listerPrestations,
  listerZones
} from './parametres'

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

/** Erreurs de saisie à plat pour l'IPC : client_id, date, lignes, ligne_<index>. */
function versErreurValidation(e: ErreursFacture): ErreurValidation {
  const erreurs: Record<string, string> = {}
  if (e.client_id) erreurs.client_id = e.client_id
  if (e.date) erreurs.date = e.date
  if (e.lignes) erreurs.lignes = e.lignes
  for (const [i, m] of Object.entries(e.parLigne)) erreurs[`ligne_${i}`] = m
  return new ErreurValidation('La facture est incomplète.', erreurs)
}

export function referentiels(db: SqlDatabase): Referentiels {
  const e = lireEntreprise(db)
  return {
    clients: listerClients(db),
    types: listerListe(db, 'types_conteneurs'),
    natures: listerListe(db, 'natures'),
    zones: listerZones(db),
    prestations: listerPrestations(db),
    taux_tva: e.taux_tva,
    prefixe_facture: e.prefixe_facture
  }
}

export function lireFacture(db: SqlDatabase, id: number): Facture {
  const f = db.prepare('SELECT * FROM factures WHERE id = ?').get(id) as
    | Omit<Facture, 'lignes' | 'origine' | 'avoir' | 'regle'>
    | undefined
  if (!f) throw new Error('Facture introuvable')
  const lignes = (
    db.prepare('SELECT * FROM lignes WHERE facture_id = ? ORDER BY ordre, id').all(id) as (Omit<
      Ligne,
      'soumis_tva'
    > & { soumis_tva: number })[]
  ).map((l) => ({ ...l, soumis_tva: l.soumis_tva === 1 }))
  const origine =
    f.facture_origine_id === null
      ? null
      : ((db.prepare('SELECT id, numero, date FROM factures WHERE id = ?').get(f.facture_origine_id) as
          | Facture['origine']
          | undefined) ?? null)
  const avoir =
    (db
      .prepare("SELECT id, numero, date FROM factures WHERE facture_origine_id = ? AND type = 'avoir' ORDER BY id LIMIT 1")
      .get(id) as Facture['avoir'] | undefined) ?? null
  const { regle } = db
    .prepare('SELECT COALESCE(SUM(montant), 0) AS regle FROM paiements WHERE facture_id = ?')
    .get(id) as { regle: number }
  return { ...f, lignes, origine, avoir, regle }
}

function libelle(db: SqlDatabase, table: 'types_conteneurs' | 'natures', code: string | null): string {
  if (code === null) return ''
  const r = db.prepare(`SELECT libelle FROM ${table} WHERE code = ?`).get(code) as
    | { libelle: string }
    | undefined
  return r?.libelle ?? code
}

/**
 * Crée ou met à jour un brouillon (lignes remplacées, totaux recalculés).
 * Retourne la facture enregistrée.
 */
export function enregistrerBrouillon(db: SqlDatabase, saisie: FactureSaisie): Facture {
  const erreurs = verifierFacture(saisie, false)
  if (erreurs) throw versErreurValidation(erreurs)

  const id = transaction(db, () => {
    const client = db.prepare('SELECT actif FROM clients WHERE id = ?').get(saisie.client_id) as
      | { actif: number }
      | undefined
    if (!client) throw new ErreurValidation('Client introuvable.', { client_id: 'Client introuvable.' })

    let factureId: number
    if (saisie.id === null) {
      if (client.actif !== 1) {
        throw new ErreurValidation('Ce client est désactivé.', { client_id: 'Ce client est désactivé.' })
      }
      const r = db
        .prepare('INSERT INTO factures (date, client_id, num_bl, notes) VALUES (?, ?, ?, ?)')
        .run(saisie.date, saisie.client_id, saisie.num_bl.trim(), saisie.notes.trim()) as {
        lastInsertRowid: number | bigint
      }
      factureId = Number(r.lastInsertRowid)
    } else {
      const f = db.prepare('SELECT statut FROM factures WHERE id = ?').get(saisie.id) as
        | { statut: string }
        | undefined
      if (!f) throw new Error('Facture introuvable')
      if (f.statut !== 'brouillon') throw new Error('Une facture validée ne peut plus être modifiée.')
      factureId = saisie.id
      db.prepare('UPDATE factures SET date = ?, client_id = ?, num_bl = ?, notes = ? WHERE id = ?').run(
        saisie.date,
        saisie.client_id,
        saisie.num_bl.trim(),
        saisie.notes.trim(),
        factureId
      )
      db.prepare('DELETE FROM lignes WHERE facture_id = ?').run(factureId)
    }

    const inserer = db.prepare(
      `INSERT INTO lignes (facture_id, ordre, num_conteneur, type_conteneur, type_libelle, zone, nature,
         nature_libelle, designation, montant_ht, soumis_tva, prestation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    saisie.lignes
      .filter((l) => !ligneVide(l))
      .forEach((l, ordre) => {
        inserer.run(
          factureId,
          ordre,
          l.num_conteneur.trim().toUpperCase(),
          l.type_conteneur,
          libelle(db, 'types_conteneurs', l.type_conteneur),
          l.zone.trim(),
          l.nature,
          libelle(db, 'natures', l.nature),
          l.designation.trim(),
          l.montant_ht,
          l.soumis_tva ? 1 : 0,
          l.prestation_id
        )
      })

    rafraichirInstantanes(db, factureId)
    return factureId
  })
  return lireFacture(db, id)
}

/**
 * Enregistre puis valide la facture : contrôles complets, numéro attribué, statut « emise ».
 * Si la validation échoue, le brouillon reste enregistré (sans numéro).
 */
export function enregistrerEtValider(db: SqlDatabase, saisie: FactureSaisie): Facture {
  const erreurs = verifierFacture(saisie, true)
  if (erreurs) throw versErreurValidation(erreurs)
  const brouillon = enregistrerBrouillon(db, saisie)
  validerFacture(db, brouillon.id)
  return lireFacture(db, brouillon.id)
}

export function supprimerBrouillon(db: SqlDatabase, id: number): void {
  const f = db.prepare('SELECT statut FROM factures WHERE id = ?').get(id) as { statut: string } | undefined
  if (!f) throw new Error('Facture introuvable')
  if (f.statut !== 'brouillon') {
    throw new Error('Une facture validée ne peut pas être supprimée : créez un avoir.')
  }
  transaction(db, () => {
    db.prepare('DELETE FROM lignes WHERE facture_id = ?').run(id)
    db.prepare('DELETE FROM factures WHERE id = ?').run(id)
  })
}

export function definirPdf(db: SqlDatabase, id: number, chemin: string): void {
  db.prepare('UPDATE factures SET pdf_path = ? WHERE id = ?').run(chemin, id)
}

/**
 * Facture calculée à partir d'une saisie, sans rien enregistrer (aperçu avant validation).
 * Les lignes vides sont ignorées ; un client manquant donne un bloc client vide.
 */
export function factureProvisoire(db: SqlDatabase, saisie: FactureSaisie): Facture {
  const e = lireEntreprise(db)
  const client = (saisie.client_id === null
    ? undefined
    : db.prepare('SELECT raison_sociale, adresse, ninea, tel, email FROM clients WHERE id = ?').get(saisie.client_id)) as
    | { raison_sociale: string; adresse: string; ninea: string; tel: string; email: string }
    | undefined
  const existante =
    saisie.id === null
      ? undefined
      : (db.prepare('SELECT numero, statut, type FROM factures WHERE id = ?').get(saisie.id) as
          | { numero: string | null; statut: Facture['statut']; type: Facture['type'] }
          | undefined)
  const lignes = saisie.lignes
    .filter((l) => !ligneVide(l))
    .map((l, ordre) => ({
      ...l,
      id: ordre + 1,
      ordre,
      montant_ht: Number.isSafeInteger(l.montant_ht) ? l.montant_ht : 0,
      type_libelle: libelle(db, 'types_conteneurs', l.type_conteneur),
      nature_libelle: libelle(db, 'natures', l.nature)
    }))
  const t = calculerTotaux(lignes, e.taux_tva)
  return {
    id: saisie.id ?? 0,
    numero: existante?.numero ?? null,
    type: existante?.type ?? 'facture',
    facture_origine_id: null,
    date: saisie.date,
    client_id: saisie.client_id ?? 0,
    num_bl: saisie.num_bl.trim(),
    statut: existante?.statut ?? 'brouillon',
    taux_tva: e.taux_tva,
    ...t,
    notes: saisie.notes,
    client_raison_sociale: client?.raison_sociale ?? '',
    client_adresse: client?.adresse ?? '',
    client_ninea: client?.ninea ?? '',
    client_tel: client?.tel ?? '',
    client_email: client?.email ?? '',
    pdf_path: null,
    cree_le: '',
    valide_le: null,
    lignes,
    origine: null,
    avoir: null,
    regle: 0
  }
}

/**
 * Facture à afficher pour une saisie : la facture enregistrée et figée si elle est émise
 * (valeurs d'origine), sinon le calcul provisoire du brouillon en cours.
 */
export function factureAAfficher(db: SqlDatabase, saisie: FactureSaisie): Facture {
  if (saisie.id !== null) {
    const f = db.prepare('SELECT statut FROM factures WHERE id = ?').get(saisie.id) as { statut: string } | undefined
    if (f && f.statut !== 'brouillon') return lireFacture(db, saisie.id)
  }
  return factureProvisoire(db, saisie)
}
