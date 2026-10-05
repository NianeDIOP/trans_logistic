import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { getSchemaVersion, MIGRATIONS, runMigrations, type Migration } from './migrations'

function newDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  return db
}

describe('runMigrations', () => {
  it('crée le schéma complet sur une base vierge', () => {
    const db = newDb()
    const version = runMigrations(db)

    expect(version).toBe(MIGRATIONS[MIGRATIONS.length - 1].version)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name)
    expect(tables).toEqual(
      expect.arrayContaining([
        'clients',
        'entreprise',
        'factures',
        'lignes',
        'paiements',
        'schema_version',
        'zones_tarifs'
      ])
    )
  })

  it("insère les informations par défaut de l'entreprise", () => {
    const db = newDb()
    runMigrations(db)
    const e = db.prepare('SELECT * FROM entreprise WHERE id = 1').get() as Record<string, unknown>

    expect(e.raison_sociale).toBe('2M LOGISTIQUE ET TRANSPORT')
    expect(e.rc).toBe('SNLGA 2021-B991')
    expect(e.ninea).toBe('008740947 2H2')
    expect(e.taux_tva).toBe(18)
    expect(e.prefixe_facture).toBe('2M')
  })

  it('est idempotent : relancer ne réapplique rien', () => {
    const db = newDb()
    const v1 = runMigrations(db)
    const v2 = runMigrations(db)

    expect(v2).toBe(v1)
    const count = db.prepare('SELECT COUNT(*) AS n FROM schema_version').get() as { n: number }
    expect(count.n).toBe(MIGRATIONS.length)
  })

  it('annule une migration en échec sans toucher la version', () => {
    const db = newDb()
    runMigrations(db)
    const before = getSchemaVersion(db)
    const broken: Migration = {
      version: before + 1,
      description: 'cassée',
      up: (d) => {
        d.exec('CREATE TABLE temporaire (id INTEGER)')
        d.exec('SELECT * FROM table_inexistante')
      }
    }

    expect(() => runMigrations(db, [...MIGRATIONS, broken])).toThrow(/migration/)
    expect(getSchemaVersion(db)).toBe(before)
    const t = db.prepare("SELECT name FROM sqlite_master WHERE name = 'temporaire'").get()
    expect(t).toBeUndefined()
  })

  it('refuse un statut de facture inconnu', () => {
    const db = newDb()
    runMigrations(db)
    db.exec("INSERT INTO clients (id, raison_sociale) VALUES (1, 'Client test')")
    expect(() =>
      db.exec(
        "INSERT INTO factures (date, client_id, statut) VALUES ('2026-01-01', 1, 'inconnu')"
      )
    ).toThrow()
  })

  it('la migration 2 conserve les données existantes', () => {
    const db = newDb()
    runMigrations(db, MIGRATIONS.filter((m) => m.version === 1))
    db.exec(`
      INSERT INTO clients (id, raison_sociale) VALUES (1, 'Client');
      INSERT INTO factures (id, date, client_id) VALUES (1, '2026-01-01', 1);
      INSERT INTO lignes (facture_id, type_conteneur, nature, montant_ht) VALUES (1, '20', 'import', 70000);
      INSERT INTO paiements (facture_id, date, montant, mode) VALUES (1, '2026-01-02', 85100, 'wave');
      INSERT INTO zones_tarifs (zone, type_conteneur, prix) VALUES ('Thiès', '40', 150000);
    `)

    expect(runMigrations(db)).toBe(2)
    expect(db.prepare('SELECT montant_ht, nature FROM lignes').get()).toEqual({
      montant_ht: 70000,
      nature: 'import'
    })
    expect(db.prepare('SELECT montant, mode FROM paiements').get()).toEqual({ montant: 85100, mode: 'wave' })
    expect(db.prepare("SELECT prix, actif FROM zones_tarifs WHERE zone = 'Thiès'").get()).toEqual({
      prix: 150000,
      actif: 1
    })
    expect(db.prepare('SELECT actif FROM clients').get()).toEqual({ actif: 1 })
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
})
