import { describe, expect, it } from 'vitest'
import { formatMontant, lireMontant } from './montants'

describe('formatMontant', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1_000, '1 000'],
    [85_100, '85 100'],
    [1_234_567, '1 234 567'],
    [-12_600, '-12 600']
  ])('%i → « %s »', (n, attendu) => {
    expect(formatMontant(n)).toBe(attendu)
  })

  it('refuse un montant non entier', () => {
    expect(() => formatMontant(10.5)).toThrow(TypeError)
  })
})

describe('lireMontant', () => {
  it.each([
    ['85 100', 85_100],
    ['85100', 85_100],
    ['85.100', 85_100],
    ['  1 500 ', 1_500],
    ['85 100', 85_100],
    ['-1 000', -1_000]
  ])('« %s » → %i', (saisie, attendu) => {
    expect(lireMontant(saisie)).toBe(attendu)
  })

  it.each(['', 'abc', '12,5', '1e3', '--5'])('« %s » → null', (saisie) => {
    expect(lireMontant(saisie)).toBeNull()
  })
})
