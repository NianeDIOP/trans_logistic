import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FactureSaisie, LigneSaisie } from '../../shared/factures'
import * as F from './factures'
import * as H from './historique'
import { runMigrations } from './migrations'
import * as P from './parametres'

let db: DatabaseSync
let sococim: number
let dangote: number

const conteneur = (num: string, montant = 70000): LigneSaisie => ({
  num_conteneur: num, type_conteneur: '20', zone: 'Dakar Zone 1', nature: 'import',
  designation: '', montant_ht: montant, soumis_tva: true, quantite: 1, prestation_id: null
})
const ags: LigneSaisie = {
  num_conteneur: '', type_conteneur: null, zone: '', nature: null, designation: 'AGS aller simple',
  montant_ht: 1500, soumis_tva: false, quantite: 1, prestation_id: 1
}
const saisie = (f: Partial<FactureSaisie> = {}): FactureSaisie => ({
  id: null, client_id: sococim, date: '2026-10-05', num_bl: '', notes: '',
  lignes: [conteneur('MSCU1234567'), ags], ...f
})
const paiement = (montant: number, mode = 'wave') => ({ date: '2026-10-10', montant, mode, reference: 'T-1' })

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  const c = { adresse: '', ninea: '', tel: '', email: '' }
  sococim = P.creerClient(db, { ...c, raison_sociale: 'SOCOCIM Industries' }).id
  dangote = P.creerClient(db, { ...c, raison_sociale: 'Dangote Cement' }).id
})

describe('listerFactures', () => {
  beforeEach(() => {
    F.enregistrerEtValider(db, saisie({ date: '2026-09-15', num_bl: 'MEDU111' }))
    F.enregistrerEtValider(db, saisie({ client_id: dangote, date: '2026-10-01', lignes: [conteneur('TGHU7654321')] }))
    F.enregistrerBrouillon(db, saisie({ date: '2026-10-04' }))
  })

  it('liste du plus récent au plus ancien, avec le nombre de conteneurs', () => {
    const p = H.listerFactures(db)
    expect(p.total).toBe(3)
    expect(p.lignes.map((l) => l.date)).toEqual(['2026-10-04', '2026-10-01', '2026-09-15'])
    expect(p.lignes[0].numero).toBeNull()
    expect(p.lignes[1].nb_conteneurs).toBe(1)
  })

  it('recherche par numéro, client, BL et conteneur', () => {
    expect(H.listerFactures(db, { recherche: '2026-0002' }).lignes[0].client_raison_sociale).toBe('Dangote Cement')
    expect(H.listerFactures(db, { recherche: 'dangote' }).total).toBe(1)
    expect(H.listerFactures(db, { recherche: 'MEDU111' }).total).toBe(1)
    expect(H.listerFactures(db, { recherche: 'tghu765' }).total).toBe(1)
  })

  it('filtre par période et par statut', () => {
    expect(H.listerFactures(db, { du: '2026-10-01', au: '2026-10-31' }).total).toBe(2)
    expect(H.listerFactures(db, { statut: 'brouillon' }).total).toBe(1)
    expect(H.listerFactures(db, { statut: 'impayee' }).total).toBe(2)
  })

  it('pagine et totalise sur tout le filtre (hors brouillons)', () => {
    const p = H.listerFactures(db, { parPage: 2, page: 2 })
    expect([p.page, p.lignes.length, p.total]).toEqual([2, 1, 3])
    expect(p.montant_ttc).toBe(84100 + 82600)
    expect(p.reste_a_encaisser).toBe(84100 + 82600)
  })
})

describe('paiements', () => {
  it('acompte puis solde : partiellement payée puis payée', () => {
    const f = F.enregistrerEtValider(db, saisie({ lignes: [conteneur('A'), ags, { ...ags, designation: 'Imprimé', montant_ht: 1000 }] }))
    expect(f.total_ttc).toBe(85100)
    const a = H.enregistrerPaiement(db, f.id, paiement(50000))
    expect([a.statut, a.regle]).toEqual(['partiellement_payee', 50000])
    const b = H.enregistrerPaiement(db, f.id, paiement(35100, 'especes'))
    expect([b.statut, b.regle]).toEqual(['payee', 85100])
    expect(H.listerPaiements(db, f.id).map((p) => p.mode_libelle)).toEqual(['Wave', 'Espèces'])
    expect(H.listerFactures(db, { statut: 'impayee' }).total).toBe(0)
  })

  it('refuse un trop-perçu, un brouillon et un mode inconnu', () => {
    const f = F.enregistrerEtValider(db, saisie())
    expect(() => H.enregistrerPaiement(db, f.id, paiement(f.total_ttc + 1))).toThrow(P.ErreurValidation)
    expect(() => H.enregistrerPaiement(db, f.id, paiement(100, 'bitcoin'))).toThrow(/invalide/)
    const b = F.enregistrerBrouillon(db, saisie())
    expect(() => H.enregistrerPaiement(db, b.id, paiement(100))).toThrow(/Validez/)
  })

  it('supprimer un règlement remet le statut à jour', () => {
    const f = F.enregistrerEtValider(db, saisie())
    const p = H.enregistrerPaiement(db, f.id, paiement(f.total_ttc))
    expect(p.statut).toBe('payee')
    const id = H.listerPaiements(db, f.id)[0].id
    expect(H.supprimerPaiement(db, id).statut).toBe('emise')
  })
})

describe('avoirs', () => {
  it('annule la facture par un avoir AV- qui reprend lignes, montants, taux et client', () => {
    const f = F.enregistrerEtValider(db, saisie())
    P.modifierEntreprise(db, { ...P.lireEntreprise(db), taux_tva: 10 })
    const a = H.creerAvoir(db, f.id, { date: '2026-10-20', motif: 'Erreur de zone' })
    expect(a.numero).toBe('AV-2M-2026-0001')
    expect(a.type).toBe('avoir')
    expect(a.statut).toBe('emise')
    expect([a.total_ht, a.total_tva, a.total_ttc, a.taux_tva]).toEqual([f.total_ht, f.total_tva, f.total_ttc, 18])
    expect(a.lignes).toHaveLength(f.lignes.length)
    expect(a.notes).toBe('Erreur de zone')
    expect(a.origine?.numero).toBe(f.numero)
    const annulee = F.lireFacture(db, f.id)
    expect(annulee.statut).toBe('annulee')
    expect(annulee.avoir?.numero).toBe('AV-2M-2026-0001')
    expect(H.listerFactures(db, { statut: 'avoir' }).lignes[0].lie_numero).toBe(f.numero)
  })

  it('refuse d’annuler deux fois, un brouillon, un avoir, ou avec une date antérieure', () => {
    const f = F.enregistrerEtValider(db, saisie())
    expect(() => H.creerAvoir(db, f.id, { date: '2026-01-01' })).toThrow(/antérieur/)
    const a = H.creerAvoir(db, f.id, { date: '2026-10-06' })
    expect(() => H.creerAvoir(db, f.id)).toThrow(/déjà annulée/)
    expect(() => H.creerAvoir(db, a.id)).toThrow(/avoir/)
    const b = F.enregistrerBrouillon(db, saisie())
    expect(() => H.creerAvoir(db, b.id)).toThrow(/brouillon/i)
    expect(() => H.enregistrerPaiement(db, f.id, paiement(100))).toThrow(/annulée/)
  })

  it('la numérotation des factures continue sans trou après un avoir', () => {
    const f = F.enregistrerEtValider(db, saisie())
    H.creerAvoir(db, f.id, { date: '2026-10-06' })
    expect(F.enregistrerEtValider(db, saisie()).numero).toBe('2M-2026-0002')
  })
})

describe('supprimerFacture', () => {
  it('supprime la dernière facture et libère son numéro', () => {
    F.enregistrerEtValider(db, saisie())
    const b = F.enregistrerEtValider(db, saisie())
    H.enregistrerPaiement(db, b.id, paiement(1000))
    const r = H.supprimerFacture(db, b.id)
    expect(r).toMatchObject({ numero: '2M-2026-0002', trou: false })
    expect(db.prepare('SELECT COUNT(*) AS n FROM paiements').get()).toEqual({ n: 0 })
    expect(F.enregistrerEtValider(db, saisie()).numero).toBe('2M-2026-0002')
  })

  it('signale le trou quand ce n’est pas le dernier numéro', () => {
    const a = F.enregistrerEtValider(db, saisie())
    F.enregistrerEtValider(db, saisie())
    expect(H.supprimerFacture(db, a.id).trou).toBe(true)
  })

  it('exige de supprimer l’avoir d’abord, et supprimer l’avoir rétablit la facture', () => {
    const f = F.enregistrerEtValider(db, saisie())
    H.enregistrerPaiement(db, f.id, paiement(1000))
    const av = H.creerAvoir(db, f.id, { date: '2026-10-06' })
    expect(() => H.supprimerFacture(db, f.id)).toThrow(/avoir/)
    H.supprimerFacture(db, av.id)
    expect(F.lireFacture(db, f.id).statut).toBe('partiellement_payee')
    expect(() => H.supprimerFacture(db, f.id)).not.toThrow()
  })
})
