import { describe, expect, it } from 'vitest'
import { statutSelonReglements, verifierPaiement } from './paiements'

describe('statutSelonReglements', () => {
  it.each([
    [85100, 0, 'emise'],
    [85100, 50000, 'partiellement_payee'],
    [85100, 85100, 'payee']
  ])('total %i, réglé %i → %s', (total, regle, statut) => {
    expect(statutSelonReglements(total, regle)).toBe(statut)
  })
})

describe('verifierPaiement', () => {
  const ok = { date: '2026-10-06', montant: 50000, mode: 'wave', reference: '' }
  it('accepte un acompte', () => {
    expect(verifierPaiement(ok, 85100)).toBeNull()
  })
  it('refuse un montant supérieur au reste, nul ou décimal', () => {
    expect(verifierPaiement({ ...ok, montant: 90000 }, 85100)?.montant).toMatch(/dépasse/)
    expect(verifierPaiement({ ...ok, montant: 0 }, 85100)?.montant).toBeDefined()
    expect(verifierPaiement({ ...ok, montant: 10.5 }, 85100)?.montant).toBeDefined()
  })
  it('exige une date et un mode', () => {
    const e = verifierPaiement({ ...ok, date: '', mode: '' }, 85100)
    expect(Object.keys(e ?? {}).sort()).toEqual(['date', 'mode'])
  })
})
