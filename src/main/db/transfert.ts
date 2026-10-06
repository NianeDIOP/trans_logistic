/**
 * Export / import de tout le contenu de l'application au format JSON,
 * pour passer d'un ordinateur à un autre sans tout ressaisir.
 *
 * Le fichier contient la version du schéma ; l'import accepte une version égale ou antérieure
 * (les colonnes absentes prennent leur valeur par défaut, les colonnes inconnues sont ignorées).
 */
import type { SqlDatabase } from './migrations'
import { MIGRATIONS } from './migrations'

export const FORMAT_EXPORT = '2m-facturation'

/** Tables exportées, dans l'ordre d'insertion (parents avant enfants). */
const TABLES = [
  'entreprise',
  'clients',
  'types_conteneurs',
  'natures',
  'modes_paiement',
  'prestations',
  'zones_tarifs',
  'factures',
  'lignes',
  'paiements'
] as const

type Ligne = Record<string, unknown>

export interface ExportDonnees {
  format: typeof FORMAT_EXPORT
  version: number
  exporte_le: string
  /** Logo et cachet en data URL (les chemins de fichiers ne valent que sur l'ordinateur d'origine). */
  images: { logo: string | null; cachet: string | null }
  tables: Record<string, Ligne[]>
}

export interface ResumeExport {
  version: number
  exporte_le: string
  raison_sociale: string
  nb_clients: number
  nb_factures: number
  nb_paiements: number
}

function colonnes(db: SqlDatabase, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name)
}

export function exporterDonnees(
  db: SqlDatabase,
  images: ExportDonnees['images'] = { logo: null, cachet: null },
  maintenant = new Date()
): ExportDonnees {
  const tables: Record<string, Ligne[]> = {}
  for (const t of TABLES) {
    tables[t] = (db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all() as Ligne[]).map((r) => ({ ...r }))
  }
  // Les chemins locaux n'ont pas de sens ailleurs : les images voyagent dans `images`.
  for (const e of tables.entreprise) {
    e.logo_path = null
    e.cachet_path = null
  }
  const version = Number((db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number }).v)
  return { format: FORMAT_EXPORT, version, exporte_le: maintenant.toISOString(), images, tables }
}

/** Vérifie la forme du fichier et en donne un résumé (avant confirmation de l'import). */
export function verifierExport(donnees: unknown): ResumeExport {
  const d = donnees as Partial<ExportDonnees> | null
  if (!d || typeof d !== 'object' || d.format !== FORMAT_EXPORT || typeof d.tables !== 'object' || !d.tables) {
    throw new Error("Ce fichier n'est pas un export de 2M Facturation.")
  }
  if (typeof d.version !== 'number' || d.version > MIGRATIONS.length) {
    throw new Error("Cet export vient d'une version plus récente de l'application : mettez-la à jour d'abord.")
  }
  for (const t of TABLES) {
    if (d.tables[t] !== undefined && !Array.isArray(d.tables[t])) throw new Error(`Table « ${t} » invalide dans l'export.`)
  }
  const n = (t: string): number => (d.tables![t] ?? []).length
  const e = (d.tables.entreprise ?? [])[0] as Ligne | undefined
  return {
    version: d.version,
    exporte_le: String(d.exporte_le ?? ''),
    raison_sociale: String(e?.raison_sociale ?? ''),
    nb_clients: n('clients'),
    nb_factures: (d.tables.factures ?? []).filter((f) => (f as Ligne).statut !== 'brouillon').length,
    nb_paiements: n('paiements')
  }
}

/**
 * Remplace tout le contenu de la base par celui de l'export, dans une seule transaction :
 * en cas d'erreur, rien n'est modifié.
 */
export function importerDonnees(db: SqlDatabase, donnees: unknown): ResumeExport {
  const resume = verifierExport(donnees)
  const d = donnees as ExportDonnees
  db.exec('BEGIN IMMEDIATE')
  try {
    // Suppression des enfants vers les parents (l'entreprise est mise à jour, pas supprimée).
    for (const t of [...TABLES].reverse()) {
      if (t === 'entreprise') continue
      if (t === 'factures') {
        db.exec("DELETE FROM factures WHERE type = 'avoir'")
      }
      db.exec(`DELETE FROM ${t}`)
    }
    db.exec("DELETE FROM sqlite_sequence WHERE name <> 'schema_version'")

    for (const t of TABLES) {
      const presentes = new Set(colonnes(db, t))
      let lignes = d.tables[t] ?? []
      // Les factures avant les avoirs qui les référencent.
      if (t === 'factures') {
        lignes = [...lignes].sort((a, b) => Number(a.type === 'avoir') - Number(b.type === 'avoir'))
      }
      if (t === 'entreprise') {
        const e = lignes[0]
        if (!e) continue
        const cols = Object.keys(e).filter((c) => presentes.has(c) && c !== 'id')
        if (cols.length) {
          db.prepare(`UPDATE entreprise SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = 1`).run(
            ...cols.map((c) => e[c] as never)
          )
        }
        continue
      }
      for (const ligne of lignes) {
        const cols = Object.keys(ligne).filter((c) => presentes.has(c))
        if (!cols.length) continue
        db.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(
          ...cols.map((c) => ligne[c] as never)
        )
      }
    }
    const fk = db.prepare('PRAGMA foreign_key_check').all()
    if (fk.length) throw new Error("L'export contient des références incohérentes (factures, clients ou règlements).")
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return resume
}
