import { describe, expect, it } from 'vitest'
import { bornesPeriode, finDeMois, joursEntre, libelleMois, moisEntre } from './periodes'

describe('bornesPeriode', () => {
  const jour = '2026-10-05'
  it.each([
    ['mois', '2026-10-01', '2026-10-31'],
    ['mois-precedent', '2026-09-01', '2026-09-30'],
    ['trimestre', '2026-10-01', '2026-12-31'],
    ['annee', '2026-01-01', '2026-12-31'],
    ['annee-precedente', '2025-01-01', '2025-12-31'],
    ['douze-mois', '2025-11-01', '2026-10-31']
  ] as const)('%s', (periode, du, au) => {
    expect(bornesPeriode(periode, jour)).toEqual({ du, au })
  })

  it('mois précédent en janvier, douze mois en décembre', () => {
    expect(bornesPeriode('mois-precedent', '2026-01-15')).toEqual({ du: '2025-12-01', au: '2025-12-31' })
    expect(bornesPeriode('douze-mois', '2026-12-15')).toEqual({ du: '2026-01-01', au: '2026-12-31' })
  })

  it('tout : pas de bornes', () => {
    expect(bornesPeriode('tout', jour)).toEqual({})
  })
})

describe('utilitaires', () => {
  it('finDeMois gère février', () => {
    expect(finDeMois(2028, 2)).toBe('2028-02-29')
    expect(finDeMois(2026, 2)).toBe('2026-02-28')
  })
  it('moisEntre', () => {
    expect(moisEntre('2025-11-10', '2026-02-01')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('libelleMois', () => {
    expect(libelleMois('2026-03')).toBe('mars 26')
    expect(libelleMois('2026-08', true)).toBe('août 2026')
  })
  it('joursEntre', () => {
    expect(joursEntre('2026-09-30', '2026-10-05')).toBe(5)
  })
})
