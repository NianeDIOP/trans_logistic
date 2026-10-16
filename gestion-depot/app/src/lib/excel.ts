// Export Excel (EF-32) : l'utilisateur choisit l'emplacement, le cœur Rust écrit le classeur .xlsx.
import { save } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { appel } from './api'
import { notifier } from './etat.svelte'

export type Cellule = string | number | null

export interface FeuilleExcel {
  nom: string
  titre: string
  sous_titre: string
  colonnes: { titre: string; largeur: number }[]
  lignes: Cellule[][]
  total?: Cellule[]
}

/** Colonnes à partir de paires [titre, largeur]. */
export const colonnes = (...c: [string, number][]) => c.map(([titre, largeur]) => ({ titre, largeur }))

/** Nom de fichier sans caractères interdits par Windows. */
export const nomFichier = (t: string) => t.replace(/[\\/:*?"<>|]/g, '-')

export async function exporterExcel(nom: string, feuilles: FeuilleExcel[]): Promise<void> {
  try {
    const chemin = await save({
      title: 'Enregistrer le classeur Excel',
      defaultPath: `${nomFichier(nom)}.xlsx`,
      filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }]
    })
    if (!chemin) return
    await appel('excel_enregistrer', { chemin, feuilles })
    notifier('Classeur Excel enregistré.')
    revealItemInDir(chemin).catch(() => undefined)
  } catch (e) {
    notifier((e as Error).message, 'erreur')
  }
}
