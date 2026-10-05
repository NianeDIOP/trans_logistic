import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from './migrations'
import { validerFacture } from './numerotation'

let db: DatabaseSync

function brouillon(date: string, type: 'facture' | 'avoir' = 'facture'): number {
  const r = db
    .prepare("INSERT INTO factures (date, client_id, type) VALUES (?, 1, ?)")
    .run(date, type)
  return Number(r.lastInsertRowid)
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  db.exec("INSERT INTO clients (id, raison_sociale) VALUES (1, 'Client test')")
})

describe('validerFacture', () => {
  it('attribue des numéros séquentiels et passe la facture en « emise »', () => {
    const a = brouillon('2026-03-01')
    const b = brouillon('2026-03-02')
    expect(validerFacture(db, a)).toBe('2M-2026-0001')
    expect(validerFacture(db, b)).toBe('2M-2026-0002')

    const f = db.prepare('SELECT statut, valide_le FROM factures WHERE id = ?').get(a) as {
      statut: string
      valide_le: string | null
    }
    expect(f.statut).toBe('emise')
    expect(f.valide_le).not.toBeNull()
  })

  it('un brouillon n’a pas de numéro', () => {
    const a = brouillon('2026-03-01')
    const f = db.prepare('SELECT numero FROM factures WHERE id = ?').get(a) as { numero: null }
    expect(f.numero).toBeNull()
  })

  it('repart à 0001 avec l’année de la facture', () => {
    validerFacture(db, brouillon('2025-12-31'))
    validerFacture(db, brouillon('2025-12-31'))
    expect(validerFacture(db, brouillon('2026-01-02'))).toBe('2M-2026-0001')
  })

  it('numérote les avoirs à part', () => {
    validerFacture(db, brouillon('2026-05-01'))
    expect(validerFacture(db, brouillon('2026-05-02', 'avoir'))).toBe('AV-2M-2026-0001')
    expect(validerFacture(db, brouillon('2026-05-03'))).toBe('2M-2026-0002')
  })

  it('utilise le préfixe des Paramètres', () => {
    db.exec("UPDATE entreprise SET prefixe_facture = 'TL' WHERE id = 1")
    expect(validerFacture(db, brouillon('2026-05-01'))).toBe('TL-2026-0001')
  })

  it('refuse de revalider une facture et ne consomme aucun numéro en cas d’échec', () => {
    const a = brouillon('2026-03-01')
    validerFacture(db, a)
    expect(() => validerFacture(db, a)).toThrow(/brouillon/)
    expect(() => validerFacture(db, 9999)).toThrow(/introuvable/)
    expect(validerFacture(db, brouillon('2026-03-05'))).toBe('2M-2026-0002')
  })
})
