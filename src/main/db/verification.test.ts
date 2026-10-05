import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { MIGRATIONS, runMigrations } from './migrations'
import { apercuBase } from './verification'

describe('apercuBase', () => {
  it('décrit une base de l’application', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db)
    db.exec("INSERT INTO clients (raison_sociale) VALUES ('A'), ('B')")
    db.exec("INSERT INTO factures (numero, date, client_id, statut) VALUES ('2M-2026-0001', '2026-10-01', 1, 'emise')")
    expect(apercuBase(db)).toEqual({
      version: MIGRATIONS.length,
      raison_sociale: '2M LOGISTIQUE ET TRANSPORT',
      nb_factures: 1,
      nb_clients: 2,
      derniere_facture: '2M-2026-0001'
    })
  })

  it('refuse une base étrangère', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE autre (id INTEGER)')
    expect(() => apercuBase(db)).toThrow(/pas une sauvegarde/)
  })
})
