import { describe, expect, it } from 'vitest'
import { formatNumero, lireSequence, prefixeDocument, prochainNumero } from './numerotation'

describe('formatNumero', () => {
  it('format {prefixe}-{année}-{0001}', () => {
    expect(formatNumero('2M', 2026, 1)).toBe('2M-2026-0001')
    expect(formatNumero('2M', 2026, 42)).toBe('2M-2026-0042')
    expect(formatNumero('2M', 2026, 12_345)).toBe('2M-2026-12345')
  })

  it('refuse une séquence ou une année invalide', () => {
    expect(() => formatNumero('2M', 2026, 0)).toThrow(RangeError)
    expect(() => formatNumero('2M', 26, 1)).toThrow(RangeError)
  })
})

describe('prefixeDocument', () => {
  it('ajoute AV- pour les avoirs', () => {
    expect(prefixeDocument('2M', 'facture')).toBe('2M')
    expect(prefixeDocument('2M', 'avoir')).toBe('AV-2M')
  })

  it('refuse un préfixe vide ou avec des caractères spéciaux', () => {
    expect(() => prefixeDocument('', 'facture')).toThrow()
    expect(() => prefixeDocument('2M%', 'facture')).toThrow()
  })
})

describe('lireSequence', () => {
  it('lit la séquence du bon préfixe et de la bonne année', () => {
    expect(lireSequence('2M-2026-0007', '2M', 2026)).toBe(7)
    expect(lireSequence('2M-2025-0007', '2M', 2026)).toBeNull()
    expect(lireSequence('AV-2M-2026-0007', '2M', 2026)).toBeNull()
    expect(lireSequence('2M-2026-abc', '2M', 2026)).toBeNull()
  })
})

describe('prochainNumero', () => {
  it('commence à 0001', () => {
    expect(prochainNumero([], '2M', 2026)).toBe('2M-2026-0001')
  })

  it('suit le plus grand numéro de l’année', () => {
    expect(prochainNumero(['2M-2026-0001', '2M-2026-0003', '2M-2026-0002'], '2M', 2026)).toBe(
      '2M-2026-0004'
    )
  })

  it('repart à 0001 chaque année', () => {
    expect(prochainNumero(['2M-2025-0150'], '2M', 2026)).toBe('2M-2026-0001')
  })

  it('séquence des avoirs indépendante de celle des factures', () => {
    const existants = ['2M-2026-0009', 'AV-2M-2026-0002']
    expect(prochainNumero(existants, 'AV-2M', 2026)).toBe('AV-2M-2026-0003')
    expect(prochainNumero(existants, '2M', 2026)).toBe('2M-2026-0010')
  })

  it('passe à 5 chiffres après 9999', () => {
    expect(prochainNumero(['2M-2026-9999'], '2M', 2026)).toBe('2M-2026-10000')
  })
})
