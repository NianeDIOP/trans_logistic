import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FactureSaisie, LigneSaisie } from '../../shared/factures'
import { exportFactures, exportLignes } from './exports'
import * as F from './factures'
import * as H from './historique'
import { runMigrations } from './migrations'
import * as P from './parametres'

let db: DatabaseSync
let client: number

const conteneur = (num: string): LigneSaisie => ({
  num_conteneur: num, type_conteneur: '20', zone: 'Dakar Zone 1', nature: 'import',
  designation: '', montant_ht: 70000, soumis_tva: true, quantite: 1, prestation_id: null
})
const ags: LigneSaisie = {
  num_conteneur: '', type_conteneur: null, zone: '', nature: null, designation: 'AGS aller simple',
  montant_ht: 1500, soumis_tva: false, quantite: 1, prestation_id: 1
}
const saisie = (f: Partial<FactureSaisie> = {}): FactureSaisie => ({
  id: null, client_id: client, date: '2026-10-05', num_bl: 'BL; 1', notes: '',
  lignes: [conteneur('MSCU1234567'), ags], ...f
})

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  client = P.creerClient(db, { raison_sociale: 'SOCOCIM Industries', adresse: '', ninea: '', tel: '', email: '' }).id
})

describe('exportFactures', () => {
  it('exporte tout le filtre, du plus ancien au plus récent, avec règlements et reste', () => {
    const a = F.enregistrerEtValider(db, saisie({ date: '2026-09-15' }))
    F.enregistrerEtValider(db, saisie())
    F.enregistrerBrouillon(db, saisie({ date: '2026-10-06' }))
    H.enregistrerPaiement(db, a.id!, { date: '2026-10-01', montant: 50000, mode: 'wave', reference: '' })

    const t = exportFactures(db, { parPage: 1 })
    expect(t.lignes).toHaveLength(3)
    const [premiere, , brouillon] = t.lignes
    expect(premiere.slice(0, 7)).toEqual(['2M-2026-0001', 'Facture', '15/09/2026', 'SOCOCIM Industries', 'BL; 1', 'Partiellement payée', 1])
    expect(premiere.slice(7, 13)).toEqual([71500, 70000, 12600, 84100, 50000, 34100])
    expect(brouillon[0]).toBe('(brouillon)')

    expect(exportFactures(db, { statut: 'brouillon' }).lignes).toHaveLength(1)
  })

  it('relie facture et avoir', () => {
    const f = F.enregistrerEtValider(db, saisie())
    H.creerAvoir(db, f.id!, { date: '2026-10-06', motif: 'Erreur' })
    const t = exportFactures(db, {})
    expect(t.lignes.map((l) => [l[0], l[1], l[5], l[12], l[13]])).toEqual([
      ['2M-2026-0001', 'Facture', 'Annulée', 0, 'AV-2M-2026-0001'],
      ['AV-2M-2026-0001', 'Avoir', 'Avoir', 0, '2M-2026-0001']
    ])
  })
})

describe('exportLignes', () => {
  it('exporte chaque ligne avec les libellés figés', () => {
    F.enregistrerEtValider(db, saisie())
    const t = exportLignes(db, { recherche: 'MSCU' })
    expect(t.lignes).toHaveLength(2)
    expect(t.lignes[0].slice(5)).toEqual(['MSCU1234567', "20'", 'Dakar Zone 1', 'Import', '', 1, 70000, true])
    expect(t.lignes[1].slice(9)).toEqual(['AGS aller simple', 1, 1500, false])
  })
})
