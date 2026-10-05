import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FactureSaisie, LigneSaisie } from '../../shared/factures'
import * as F from './factures'
import * as H from './historique'
import { runMigrations } from './migrations'
import * as P from './parametres'
import { tableauDeBord } from './statistiques'

let db: DatabaseSync
let a: number
let b: number

const tc = (type: string, zone: string, montant: number): LigneSaisie => ({
  num_conteneur: 'X', type_conteneur: type, zone, nature: 'import', designation: '',
  montant_ht: montant, soumis_tva: true, prestation_id: null
})
const ags: LigneSaisie = {
  num_conteneur: '', type_conteneur: null, zone: '', nature: null, designation: 'AGS',
  montant_ht: 1500, soumis_tva: false, prestation_id: 1
}
const facture = (client: number, date: string, lignes: LigneSaisie[]): FactureSaisie => ({
  id: null, client_id: client, date, num_bl: '', notes: '', lignes
})

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  const c = { adresse: '', ninea: '', tel: '', email: '' }
  a = P.creerClient(db, { ...c, raison_sociale: 'SOCOCIM' }).id
  b = P.creerClient(db, { ...c, raison_sociale: 'Dangote' }).id
  // Septembre : 1 facture SOCOCIM (2 × 20'), octobre : 1 Dangote (40') payée à moitié, 1 SOCOCIM annulée.
  F.enregistrerEtValider(db, facture(a, '2026-09-10', [tc('20', 'Dakar Zone 1', 70000), tc('20', 'Thiès', 120000), ags]))
  const d = F.enregistrerEtValider(db, facture(b, '2026-10-02', [tc('40', 'Thiès', 180000)]))
  H.enregistrerPaiement(db, d.id, { date: '2026-10-03', montant: 100000, mode: 'wave', reference: '' })
  const x = F.enregistrerEtValider(db, facture(a, '2026-10-03', [tc('20', 'Dakar Zone 1', 70000)]))
  H.creerAvoir(db, x.id, { date: '2026-10-04' })
  F.enregistrerBrouillon(db, facture(b, '2026-10-05', [tc('20', 'Dakar Zone 1', 999999)]))
})

describe('tableauDeBord', () => {
  it('CA du mois et de l’année nets des avoirs, brouillons exclus', () => {
    const t = tableauDeBord(db, {}, '2026-10-05')
    // Octobre : 180 000 + 70 000 − 70 000 (avoir) = 180 000 HT
    expect(t.mois).toEqual({ ht: 180000, tva: 32400, ttc: 212400 })
    expect(t.annee.ht).toBe(191500 + 180000)
    expect(t.annee.tva).toBe(34200 + 32400)
  })

  it('impayés : reste dû à ce jour, factures annulées exclues', () => {
    const t = tableauDeBord(db, {}, '2026-10-05')
    expect(t.impayes.nombre).toBe(2)
    expect(t.impayes.montant).toBe(225700 + (212400 - 100000))
    expect(t.impayes.liste[0]).toMatchObject({ client: 'SOCOCIM', jours: 25 })
  })

  it('série mensuelle complète sur la période, mois vides compris', () => {
    const t = tableauDeBord(db, { du: '2026-08-01', au: '2026-10-31' }, '2026-10-05')
    expect(t.parMois.map((p) => [p.mois, p.ht])).toEqual([
      ['2026-08', 0],
      ['2026-09', 191500],
      ['2026-10', 180000]
    ])
  })

  it('période « tout » : du premier document à aujourd’hui', () => {
    const t = tableauDeBord(db, {}, '2026-10-05')
    expect([t.du, t.au]).toEqual(['2026-09-10', '2026-10-05'])
    expect(t.periode.nb_factures).toBe(2)
  })

  it('top clients au CA net, conteneurs par type et par zone hors factures annulées', () => {
    const t = tableauDeBord(db, {}, '2026-10-05')
    expect(t.topClients.map((c) => [c.client, c.ht])).toEqual([
      ['SOCOCIM', 191500],
      ['Dangote', 180000]
    ])
    expect(t.periode.nb_conteneurs).toBe(3)
    expect(t.conteneursParType).toEqual([
      { libelle: "20'", nombre: 2 },
      { libelle: "40'", nombre: 1 }
    ])
    expect(t.conteneursParZone).toEqual([
      { zone: 'Thiès', nombre: 2 },
      { zone: 'Dakar Zone 1', nombre: 1 }
    ])
  })

  it('base vide', () => {
    const vide = new DatabaseSync(':memory:')
    runMigrations(vide)
    const t = tableauDeBord(vide, {}, '2026-10-05')
    expect(t.mois.ht).toBe(0)
    expect(t.parMois).toEqual([{ mois: '2026-10', ht: 0, tva: 0, ttc: 0 }])
    expect(t.topClients).toEqual([])
  })
})
