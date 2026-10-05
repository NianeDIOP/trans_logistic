import { describe, expect, it } from 'vitest'
import { montantEnLettres, nombreEnLettres } from './lettres'

const cas: [number, string][] = [
  [0, 'zéro'],
  [1, 'un'],
  [10, 'dix'],
  [16, 'seize'],
  [17, 'dix-sept'],
  [20, 'vingt'],
  [21, 'vingt et un'],
  [22, 'vingt-deux'],
  [31, 'trente et un'],
  [61, 'soixante et un'],
  [70, 'soixante-dix'],
  [71, 'soixante et onze'],
  [72, 'soixante-douze'],
  [79, 'soixante-dix-neuf'],
  [80, 'quatre-vingts'],
  [81, 'quatre-vingt-un'],
  [88, 'quatre-vingt-huit'],
  [90, 'quatre-vingt-dix'],
  [91, 'quatre-vingt-onze'],
  [99, 'quatre-vingt-dix-neuf'],
  [100, 'cent'],
  [101, 'cent un'],
  [180, 'cent quatre-vingts'],
  [200, 'deux cents'],
  [201, 'deux cent un'],
  [280, 'deux cent quatre-vingts'],
  [999, 'neuf cent quatre-vingt-dix-neuf'],
  [1_000, 'mille'],
  [1_001, 'mille un'],
  [1_500, 'mille cinq cents'],
  [2_000, 'deux mille'],
  [21_000, 'vingt et un mille'],
  [80_000, 'quatre-vingt mille'],
  [80_080, 'quatre-vingt mille quatre-vingts'],
  [100_000, 'cent mille'],
  [200_000, 'deux cent mille'],
  [72_500, 'soixante-douze mille cinq cents'],
  [12_600, 'douze mille six cents'],
  [85_100, 'quatre-vingt-cinq mille cent'],
  [1_000_000, 'un million'],
  [1_000_001, 'un million un'],
  [2_000_000, 'deux millions'],
  [21_000_000, 'vingt et un millions'],
  [80_000_000, 'quatre-vingts millions'],
  [200_000_000, 'deux cents millions'],
  [1_200_000, 'un million deux cent mille'],
  [3_480_271, 'trois millions quatre cent quatre-vingt mille deux cent soixante et onze'],
  [999_999_999, 'neuf cent quatre-vingt-dix-neuf millions neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf']
]

describe('nombreEnLettres', () => {
  it.each(cas)('%i → %s', (n, attendu) => {
    expect(nombreEnLettres(n)).toBe(attendu)
  })

  it('refuse les valeurs hors limites ou non entières', () => {
    expect(() => nombreEnLettres(-1)).toThrow(RangeError)
    expect(() => nombreEnLettres(1_000_000_000)).toThrow(RangeError)
    expect(() => nombreEnLettres(1.5)).toThrow(RangeError)
  })
})

describe('montantEnLettres', () => {
  it('cas obligatoire : 85 100', () => {
    expect(montantEnLettres(85_100)).toBe('Quatre-vingt-cinq mille cent francs CFA')
  })

  it('singulier pour zéro et un', () => {
    expect(montantEnLettres(0)).toBe('Zéro franc CFA')
    expect(montantEnLettres(1)).toBe('Un franc CFA')
  })

  it('« de » après un nombre rond de millions', () => {
    expect(montantEnLettres(2_000_000)).toBe('Deux millions de francs CFA')
    expect(montantEnLettres(2_000_500)).toBe('Deux millions cinq cents francs CFA')
  })

  it('montant négatif (avoir)', () => {
    expect(montantEnLettres(-85_100)).toBe('Moins quatre-vingt-cinq mille cent francs CFA')
  })
})
