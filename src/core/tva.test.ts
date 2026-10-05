import { describe, expect, it } from 'vitest'
import { calculerTotaux, calculerTva } from './tva'

describe('calculerTotaux', () => {
  it('cas obligatoire du cahier des charges : 72 500 / 12 600 / 85 100', () => {
    const totaux = calculerTotaux(
      [
        { montant_ht: 70_000, soumis_tva: true }, // Transport Dakar Zone 1, conteneur 20'
        { montant_ht: 1_500, soumis_tva: false }, // AGS aller simple
        { montant_ht: 1_000, soumis_tva: false } // Imprimé
      ],
      18
    )
    expect(totaux).toEqual({
      total_ht: 72_500,
      base_tva: 70_000,
      total_tva: 12_600,
      total_ttc: 85_100
    })
  })

  it('facture vide', () => {
    expect(calculerTotaux([], 18)).toEqual({ total_ht: 0, base_tva: 0, total_tva: 0, total_ttc: 0 })
  })

  it('aucune ligne soumise à TVA', () => {
    const t = calculerTotaux([{ montant_ht: 2_500, soumis_tva: false }], 18)
    expect(t).toEqual({ total_ht: 2_500, base_tva: 0, total_tva: 0, total_ttc: 2_500 })
  })

  it('plusieurs conteneurs soumis à TVA', () => {
    const t = calculerTotaux(
      [
        { montant_ht: 70_000, soumis_tva: true },
        { montant_ht: 120_000, soumis_tva: true },
        { montant_ht: 1_500, soumis_tva: false }
      ],
      18
    )
    expect(t).toEqual({ total_ht: 191_500, base_tva: 190_000, total_tva: 34_200, total_ttc: 225_700 })
  })

  it('applique le taux paramétré', () => {
    expect(calculerTotaux([{ montant_ht: 10_000, soumis_tva: true }], 10).total_tva).toBe(1_000)
    expect(calculerTotaux([{ montant_ht: 10_000, soumis_tva: true }], 0).total_tva).toBe(0)
  })

  it('refuse un montant non entier', () => {
    expect(() => calculerTotaux([{ montant_ht: 100.5, soumis_tva: true }], 18)).toThrow(TypeError)
  })
})

describe('calculerTva', () => {
  it('arrondit à l’entier le plus proche', () => {
    expect(calculerTva(1_001, 18)).toBe(180) // 180,18
    expect(calculerTva(1_003, 18)).toBe(181) // 180,54
    expect(calculerTva(25, 18)).toBe(5) // 4,5 → 5
  })

  it('arrondit symétriquement les montants négatifs (avoirs)', () => {
    expect(calculerTva(-70_000, 18)).toBe(-12_600)
    expect(calculerTva(-25, 18)).toBe(-5)
  })

  it('refuse un taux invalide', () => {
    expect(() => calculerTva(1_000, 18.5)).toThrow()
    expect(() => calculerTva(1_000, -1)).toThrow(RangeError)
    expect(() => calculerTva(1_000, 101)).toThrow(RangeError)
  })
})
