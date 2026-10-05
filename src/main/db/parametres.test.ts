import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from './migrations'
import * as P from './parametres'

let db: DatabaseSync

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
})

const client = { raison_sociale: 'SOCOCIM', adresse: 'Rufisque', ninea: '', tel: '', email: '' }

function factureAvecLigne(clientId: number, ligne: Record<string, unknown> = {}): void {
  const f = db
    .prepare("INSERT INTO factures (date, client_id) VALUES ('2026-10-05', ?)")
    .run(clientId)
  db.prepare(
    `INSERT INTO lignes (facture_id, zone, type_conteneur, nature, designation, montant_ht, soumis_tva)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    Number(f.lastInsertRowid),
    (ligne.zone as string) ?? '',
    (ligne.type_conteneur as string) ?? null,
    (ligne.nature as string) ?? null,
    (ligne.designation as string) ?? '',
    70000,
    1
  )
}

describe('migration 2 : valeurs de départ', () => {
  it('insère prestations, types, natures, modes de paiement et un tarif exemple', () => {
    expect(P.listerPrestations(db).map((p) => [p.libelle, p.prix, p.soumis_tva])).toEqual([
      ['AGS aller simple', 1500, false],
      ['Imprimé', 1000, false]
    ])
    expect(P.listerListe(db, 'types_conteneurs').map((e) => e.libelle)).toEqual(["20'", "40'"])
    expect(P.listerListe(db, 'natures').map((e) => e.code)).toEqual(['import', 'export'])
    expect(P.listerListe(db, 'modes_paiement')).toHaveLength(5)
    expect(P.listerZones(db)).toEqual([{ zone: 'Dakar Zone 1', actif: true, prix: { '20': 70000 } }])
    expect(P.lireEntreprise(db).mentions).toBe('')
  })

  it('accepte un type de conteneur paramétré dans les lignes (plus de liste figée)', () => {
    const c = P.creerClient(db, client)
    expect(() => factureAvecLigne(c.id, { type_conteneur: '40_hc', nature: 'transit' })).not.toThrow()
  })
})

describe('entreprise', () => {
  it('modifie les informations et valide la saisie', () => {
    const e = P.lireEntreprise(db)
    const maj = P.modifierEntreprise(db, { ...e, taux_tva: 10, prefixe_facture: 'tl', mentions: 'A\nB' })
    expect(maj.taux_tva).toBe(10)
    expect(maj.prefixe_facture).toBe('TL')
    expect(maj.mentions).toBe('A\nB')
    expect(() => P.modifierEntreprise(db, { ...e, raison_sociale: '' })).toThrow(P.ErreurValidation)
  })

  it('enregistre le chemin du logo et du cachet', () => {
    P.definirImage(db, 'logo', 'C:/logo.png')
    P.definirImage(db, 'cachet', 'C:/cachet.png')
    const e = P.lireEntreprise(db)
    expect([e.logo_path, e.cachet_path]).toEqual(['C:/logo.png', 'C:/cachet.png'])
    P.definirImage(db, 'logo', null)
    expect(P.lireEntreprise(db).logo_path).toBeNull()
  })
})

describe('clients', () => {
  it('crée, recherche et modifie', () => {
    const c = P.creerClient(db, client)
    P.creerClient(db, { ...client, raison_sociale: 'Dangote Cement', ninea: '0045' })
    expect(P.listerClients(db).map((x) => x.raison_sociale)).toEqual(['Dangote Cement', 'SOCOCIM'])
    expect(P.listerClients(db, { recherche: '0045' })).toHaveLength(1)
    expect(P.modifierClient(db, c.id, { ...client, tel: '77 000 00 00' }).tel).toBe('77 000 00 00')
  })

  it('refuse un doublon (sans tenir compte de la casse)', () => {
    P.creerClient(db, client)
    expect(() => P.creerClient(db, { ...client, raison_sociale: 'sococim' })).toThrow(/existe déjà/)
  })

  it('supprime un client sans facture, désactive un client facturé', () => {
    const a = P.creerClient(db, client)
    const b = P.creerClient(db, { ...client, raison_sociale: 'Facturé' })
    factureAvecLigne(b.id)
    expect(P.supprimerClient(db, a.id)).toBe('supprime')
    expect(P.supprimerClient(db, b.id)).toBe('desactive')
    expect(P.listerClients(db)).toHaveLength(0)
    expect(P.listerClients(db, { inclureInactifs: true })[0].actif).toBe(false)
    P.reactiverClient(db, b.id)
    expect(P.listerClients(db)).toHaveLength(1)
  })
})

describe('zones et tarifs', () => {
  it('crée une zone avec plusieurs prix', () => {
    const z = P.enregistrerZone(db, null, { zone: 'Thiès', prix: { '20': 120000, '40': 180000 } })
    expect(z).toEqual({ zone: 'Thiès', actif: true, prix: { '20': 120000, '40': 180000 } })
  })

  it('renomme une zone, modifie et retire des prix', () => {
    P.enregistrerZone(db, 'Dakar Zone 1', { zone: 'Dakar Zone A', prix: { '20': 75000, '40': 110000 } })
    expect(P.listerZones(db)).toEqual([
      { zone: 'Dakar Zone A', actif: true, prix: { '20': 75000, '40': 110000 } }
    ])
    P.enregistrerZone(db, 'Dakar Zone A', { zone: 'Dakar Zone A', prix: { '20': null, '40': 110000 } })
    expect(P.listerZones(db)[0].prix).toEqual({ '40': 110000 })
  })

  it('refuse deux zones de même nom', () => {
    expect(() => P.enregistrerZone(db, null, { zone: 'dakar zone 1', prix: { '20': 1 } })).toThrow(
      /existe déjà/
    )
  })

  it('désactive une zone utilisée par une facture, supprime sinon', () => {
    const c = P.creerClient(db, client)
    factureAvecLigne(c.id, { zone: 'Dakar Zone 1' })
    P.enregistrerZone(db, null, { zone: 'Thiès', prix: { '20': 1 } })
    expect(P.supprimerZone(db, 'Dakar Zone 1')).toBe('desactive')
    expect(P.supprimerZone(db, 'Thiès')).toBe('supprime')
    expect(P.listerZones(db)).toEqual([])
    expect(P.listerZones(db, true)).toHaveLength(1)
  })
})

describe('prestations', () => {
  it('crée, modifie et ordonne', () => {
    const p = P.creerPrestation(db, { libelle: 'Manutention', prix: 5000, soumis_tva: true })
    expect(p.ordre).toBe(3)
    expect(P.modifierPrestation(db, p.id, { libelle: 'Manutention', prix: 6000, soumis_tva: true }).prix).toBe(6000)
    expect(P.listerPrestations(db).map((x) => x.libelle)).toEqual(['AGS aller simple', 'Imprimé', 'Manutention'])
  })

  it('désactive une prestation déjà facturée', () => {
    const c = P.creerClient(db, client)
    factureAvecLigne(c.id, { designation: 'Imprimé' })
    const [ags, imprime] = P.listerPrestations(db)
    expect(P.supprimerPrestation(db, imprime.id)).toBe('desactive')
    expect(P.supprimerPrestation(db, ags.id)).toBe('supprime')
  })
})

describe('listes', () => {
  it('ajoute avec un code dérivé du libellé, unique', () => {
    const e = P.ajouterElement(db, 'types_conteneurs', "40' HC")
    expect(e.code).toBe('40_hc')
    expect(P.ajouterElement(db, 'natures', 'Transit').code).toBe('transit')
    expect(() => P.ajouterElement(db, 'natures', 'transit')).toThrow(/existe déjà/)
    expect(() => P.ajouterElement(db, 'natures', '  ')).toThrow(P.ErreurValidation)
  })

  it('renomme sans changer le code', () => {
    const [vingt] = P.listerListe(db, 'types_conteneurs')
    const e = P.renommerElement(db, 'types_conteneurs', vingt.id, '20 pieds')
    expect([e.code, e.libelle]).toEqual(['20', '20 pieds'])
  })

  it('désactive un type utilisé par la grille tarifaire, supprime un type inutilisé', () => {
    const [vingt, quarante] = P.listerListe(db, 'types_conteneurs')
    expect(P.supprimerElement(db, 'types_conteneurs', vingt.id)).toBe('desactive')
    expect(P.supprimerElement(db, 'types_conteneurs', quarante.id)).toBe('supprime')
  })

  it('désactive un mode de paiement déjà utilisé', () => {
    const c = P.creerClient(db, client)
    factureAvecLigne(c.id)
    db.exec("INSERT INTO paiements (facture_id, date, montant, mode) VALUES (1, '2026-10-05', 1000, 'wave')")
    const wave = P.listerListe(db, 'modes_paiement').find((m) => m.code === 'wave')!
    expect(P.supprimerElement(db, 'modes_paiement', wave.id)).toBe('desactive')
    P.reactiverElement(db, 'modes_paiement', wave.id)
    expect(P.listerListe(db, 'modes_paiement')).toHaveLength(5)
  })

  it('refuse une liste inconnue', () => {
    expect(() => P.listerListe(db, 'clients' as never)).toThrow(/inconnue/)
  })
})
