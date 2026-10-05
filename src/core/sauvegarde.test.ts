import { describe, expect, it } from 'vitest'
import { nomFichierSauvegarde, sauvegardeAutoDue, sauvegardesASupprimer } from './sauvegarde'

describe('sauvegardes', () => {
  it('nom horodaté', () => {
    expect(nomFichierSauvegarde(new Date(2026, 9, 5, 14, 3))).toBe('2M-Facturation_2026-10-05_14h03.db')
    expect(nomFichierSauvegarde(new Date(2026, 0, 2, 9, 0), 'avant-restauration')).toBe(
      '2M-Facturation_2026-01-02_09h00_avant-restauration.db'
    )
  })

  it('sauvegarde automatique toutes les 24 h', () => {
    const maintenant = new Date(2026, 9, 5, 12)
    expect(sauvegardeAutoDue(null, maintenant)).toBe(true)
    expect(sauvegardeAutoDue(new Date(2026, 9, 4, 13), maintenant)).toBe(false)
    expect(sauvegardeAutoDue(new Date(2026, 9, 4, 12), maintenant)).toBe(true)
  })

  it('garde les plus récentes', () => {
    const noms = ['2M-Facturation_2026-10-03_08h00.db', 'autre.txt', '2M-Facturation_2026-10-01_08h00.db', '2M-Facturation_2026-10-02_08h00.db']
    expect(sauvegardesASupprimer(noms, 2)).toEqual(['2M-Facturation_2026-10-01_08h00.db'])
    expect(sauvegardesASupprimer(noms, 10)).toEqual([])
  })
})
