import { describe, expect, it } from 'vitest'
import {
  codeDepuisLibelle,
  validerClient,
  validerEntreprise,
  validerPrestation,
  validerZone
} from './parametres'

const entreprise = {
  raison_sociale: '2M LOGISTIQUE ET TRANSPORT',
  rc: 'SNLGA 2021-B991',
  ninea: '008740947 2H2',
  banque: 'BICIS Louga',
  iban: 'SN10 07534 007766000006 09',
  siege: 'Dakar',
  adresse: 'Quartier Thiokhna, Louga',
  email: '2mlogistiquetransport25@gmail.com',
  tel: '(+221) 77 533 65 33',
  taux_tva: 18,
  prefixe_facture: '2M',
  mentions: 'Paiement à 30 jours.\nMerci de votre confiance.'
}

describe('validerClient', () => {
  it('nettoie les espaces', () => {
    const r = validerClient({ raison_sociale: '  SOCOCIM   SA ', adresse: '', ninea: '', tel: '', email: '' })
    expect(r).toEqual({
      ok: true,
      valeur: { raison_sociale: 'SOCOCIM SA', adresse: '', ninea: '', tel: '', email: '' }
    })
  })

  it('exige la raison sociale et un email valide', () => {
    const r = validerClient({ raison_sociale: ' ', adresse: '', ninea: '', tel: '', email: 'x@' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erreurs).sort()).toEqual(['email', 'raison_sociale'])
  })
})

describe('validerPrestation', () => {
  it('accepte une prestation hors TVA', () => {
    expect(validerPrestation({ libelle: 'AGS aller simple', prix: 1500, soumis_tva: false }).ok).toBe(true)
  })

  it('refuse un prix négatif ou décimal', () => {
    expect(validerPrestation({ libelle: 'X', prix: -1, soumis_tva: false }).ok).toBe(false)
    expect(validerPrestation({ libelle: 'X', prix: 10.5, soumis_tva: false }).ok).toBe(false)
  })
})

describe('validerZone', () => {
  it('exige un nom et au moins un prix', () => {
    expect(validerZone({ zone: 'Dakar Zone 1', prix: { '20': 70000, '40': null } }).ok).toBe(true)
    expect(validerZone({ zone: '', prix: { '20': 70000 } }).ok).toBe(false)
    expect(validerZone({ zone: 'Thiès', prix: { '20': null } }).ok).toBe(false)
    expect(validerZone({ zone: 'Thiès', prix: { '20': 1.5 } }).ok).toBe(false)
  })
})

describe('validerEntreprise', () => {
  it('accepte les valeurs par défaut et garde les retours à la ligne des mentions', () => {
    const r = validerEntreprise(entreprise)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.valeur.mentions).toContain('\n')
  })

  it('met le préfixe en majuscules', () => {
    const r = validerEntreprise({ ...entreprise, prefixe_facture: '2m' })
    expect(r.ok && r.valeur.prefixe_facture).toBe('2M')
  })

  it('refuse un taux invalide, un préfixe invalide ou réservé', () => {
    expect(validerEntreprise({ ...entreprise, taux_tva: 18.5 }).ok).toBe(false)
    expect(validerEntreprise({ ...entreprise, taux_tva: 120 }).ok).toBe(false)
    expect(validerEntreprise({ ...entreprise, prefixe_facture: '2M 26' }).ok).toBe(false)
    expect(validerEntreprise({ ...entreprise, prefixe_facture: 'av' }).ok).toBe(false)
  })
})

describe('codeDepuisLibelle', () => {
  it.each([
    ['Orange Money', 'orange_money'],
    ['Espèces', 'especes'],
    ["40' HC", '40_hc'],
    ['  Transit  ', 'transit']
  ])('%s → %s', (libelle, code) => {
    expect(codeDepuisLibelle(libelle)).toBe(code)
  })
})
