import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import type { FactureSaisie } from '../../shared/factures'
import * as F from './factures'
import * as H from './historique'
import { runMigrations } from './migrations'
import * as P from './parametres'
import { exporterDonnees, importerDonnees, verifierExport } from './transfert'

function base(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  return db
}

function remplir(db: DatabaseSync): void {
  const c = P.creerClient(db, { raison_sociale: 'SOCOCIM', adresse: 'Rufisque', ninea: '1', tel: '', email: '' })
  P.enregistrerZone(db, null, { zone: 'Thiès', prix: { '20': 120000, '40': 180000 } })
  P.ajouterElement(db, 'natures', 'Transit')
  P.modifierEntreprise(db, { ...P.lireEntreprise(db), mentions: 'Merci', taux_tva: 18 })
  const s: FactureSaisie = {
    id: null, client_id: c.id, date: '2026-10-05', num_bl: 'BL1', notes: '',
    lignes: [
      { num_conteneur: 'A', type_conteneur: '20', zone: 'Thiès', nature: 'import', designation: '', montant_ht: 120000, soumis_tva: true, quantite: 1, prestation_id: null },
      { num_conteneur: '', type_conteneur: null, zone: '', nature: null, designation: 'AGS aller simple', montant_ht: 1500, soumis_tva: false, quantite: 1, prestation_id: 1 }
    ]
  }
  const f = F.enregistrerEtValider(db, s)
  H.enregistrerPaiement(db, f.id, { date: '2026-10-06', montant: 50000, mode: 'wave', reference: 'X' })
  const g = F.enregistrerEtValider(db, s)
  H.creerAvoir(db, g.id, { date: '2026-10-07', motif: 'Erreur' })
  F.enregistrerBrouillon(db, s)
}

describe('export / import JSON', () => {
  it('transfère tout le contenu vers une autre base', () => {
    const source = base()
    remplir(source)
    const exp = JSON.parse(JSON.stringify(exporterDonnees(source, { logo: 'data:image/png;base64,AA', cachet: null })))
    expect(verifierExport(exp)).toMatchObject({ raison_sociale: '2M LOGISTIQUE ET TRANSPORT', nb_clients: 1, nb_factures: 3, nb_paiements: 1 })

    const cible = base()
    P.creerClient(cible, { raison_sociale: 'À écraser', adresse: '', ninea: '', tel: '', email: '' })
    importerDonnees(cible, exp)

    for (const t of ['clients', 'zones_tarifs', 'natures', 'factures', 'lignes', 'paiements', 'prestations']) {
      expect(cible.prepare(`SELECT * FROM ${t} ORDER BY id`).all()).toEqual(source.prepare(`SELECT * FROM ${t} ORDER BY id`).all())
    }
    expect(P.lireEntreprise(cible).mentions).toBe('Merci')
    // La numérotation continue normalement après l'import.
    const s = F.lireFacture(cible, 1)
    const suite = F.enregistrerEtValider(cible, { id: null, client_id: s.client_id, date: '2026-10-08', num_bl: '', notes: '', lignes: s.lignes })
    expect(suite.numero).toBe('2M-2026-0003')
  })

  it('refuse un fichier étranger ou plus récent, sans rien modifier', () => {
    const db = base()
    remplir(db)
    expect(() => importerDonnees(db, { foo: 1 })).toThrow(/pas un export/)
    expect(() => importerDonnees(db, { format: '2m-facturation', version: 999, tables: {} })).toThrow(/plus récente/)
    const casse = { format: '2m-facturation', version: 1, exporte_le: '', images: {}, tables: { paiements: [{ id: 1, facture_id: 999, date: '2026-01-01', montant: 1, mode: 'wave' }] } }
    expect(() => importerDonnees(db, casse)).toThrow()
    expect(db.prepare('SELECT COUNT(*) AS n FROM factures').get()).toEqual({ n: 4 })
  })
})
