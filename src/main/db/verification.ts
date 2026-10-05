import type { SqlDatabase } from './migrations'

export interface ApercuBase {
  version: number
  raison_sociale: string
  nb_factures: number
  nb_clients: number
  derniere_facture: string | null
}

/**
 * Vérifie qu'une base est bien une base de l'application (avant restauration) et en donne un aperçu.
 * Lève une erreur explicite sinon.
 */
export function apercuBase(db: SqlDatabase): ApercuBase {
  const tables = new Set(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name)
  )
  for (const t of ['schema_version', 'entreprise', 'clients', 'factures', 'lignes']) {
    if (!tables.has(t)) throw new Error("Ce fichier n'est pas une sauvegarde de 2M Facturation.")
  }
  const integrite = db.prepare('PRAGMA integrity_check').get() as Record<string, string>
  if (Object.values(integrite)[0] !== 'ok') throw new Error('Ce fichier de sauvegarde est endommagé.')

  const n = (sql: string): number => Number((db.prepare(sql).get() as { n: number }).n)
  const e = db.prepare('SELECT raison_sociale FROM entreprise WHERE id = 1').get() as
    | { raison_sociale: string }
    | undefined
  const derniere = db
    .prepare("SELECT numero FROM factures WHERE numero IS NOT NULL ORDER BY date DESC, id DESC LIMIT 1")
    .get() as { numero: string } | undefined
  return {
    version: n('SELECT COALESCE(MAX(version), 0) AS n FROM schema_version'),
    raison_sociale: e?.raison_sociale ?? '',
    nb_factures: n("SELECT COUNT(*) AS n FROM factures WHERE statut <> 'brouillon'"),
    nb_clients: n('SELECT COUNT(*) AS n FROM clients'),
    derniere_facture: derniere?.numero ?? null
  }
}
