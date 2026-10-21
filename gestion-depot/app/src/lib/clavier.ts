// Saisie rapide au clavier dans les grilles (fiche du jour, réceptions, alimentations, inventaire) — ET-05.
//
// Chaque champ de la grille porte `data-col` (nom de colonne). Dans le conteneur :
// - Entrée : case suivante selon le réglage (↓ même colonne, ligne suivante ; → case suivante de la ligne) ;
//   Maj+Entrée : retour en arrière. En bas d'une colonne, Entrée passe en haut de la colonne suivante.
// - Flèches ↑ ↓ : même colonne ; ← → : case voisine quand le curseur est au bord du texte.
// - À l'arrivée dans une case, son contenu est sélectionné : taper remplace la valeur.
// - Seuls les chiffres sont acceptés dans les champs numériques.
import { preferences } from './etat.svelte'

export interface OptionsGrille {
  /** Appelé quand on dépasse la dernière case (ex. passer au total reçu). */
  fin?: () => void
}

const SELECTEUR = 'input[data-col]:not([disabled]):not([readonly])'

function champs(racine: HTMLElement): HTMLInputElement[] {
  return [...racine.querySelectorAll<HTMLInputElement>(SELECTEUR)].filter((c) => c.offsetParent !== null)
}

function colonnes(liste: HTMLInputElement[]): string[] {
  return [...new Set(liste.map((c) => c.dataset.col!))]
}

/** Donne le focus à un champ, le rend visible et sélectionne son contenu. */
export function aller(champ: HTMLElement | null | undefined): boolean {
  if (!champ) return false
  champ.focus({ preventScroll: true })
  champ.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  if (champ instanceof HTMLInputElement) champ.select()
  return true
}

/** Case suivante (sens = 1) ou précédente (sens = -1) selon le mode « colonne » (↓) ou « ligne » (→). */
function voisin(racine: HTMLElement, depuis: HTMLInputElement, sens: 1 | -1, mode: 'colonne' | 'ligne') {
  const liste = champs(racine)
  if (mode === 'ligne') return liste[liste.indexOf(depuis) + sens]
  const cols = colonnes(liste)
  const col = depuis.dataset.col!
  const memeCol = liste.filter((c) => c.dataset.col === col)
  const i = memeCol.indexOf(depuis)
  if (memeCol[i + sens]) return memeCol[i + sens]
  // Bout de colonne : début (ou fin) de la colonne voisine.
  const autre = cols[cols.indexOf(col) + sens]
  if (!autre) return undefined
  const suivante = liste.filter((c) => c.dataset.col === autre)
  return sens === 1 ? suivante[0] : suivante[suivante.length - 1]
}

function caretAuBord(c: HTMLInputElement, cote: 'debut' | 'fin'): boolean {
  const { selectionStart: d, selectionEnd: f, value } = c
  if (d === null || f === null) return true
  if (d === 0 && f === value.length) return true // tout sélectionné
  return cote === 'debut' ? d === 0 && f === 0 : d === value.length
}

export function grille(racine: HTMLElement, options: OptionsGrille = {}) {
  let opts = options

  function touche(e: KeyboardEvent) {
    const c = e.target as HTMLInputElement
    if (!(c instanceof HTMLInputElement) || !c.matches(SELECTEUR)) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    // Champs numériques : chiffres uniquement (les touches de commande passent).
    if (c.inputMode === 'numeric' && e.key.length === 1 && !/[0-9 ]/.test(e.key)) {
      e.preventDefault()
      return
    }

    let cible: HTMLInputElement | undefined
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        cible = voisin(racine, c, e.shiftKey ? -1 : 1, preferences.entree)
        if (!cible && !e.shiftKey) opts.fin?.()
        break
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        cible = (() => {
          const memeCol = champs(racine).filter((x) => x.dataset.col === c.dataset.col)
          return memeCol[memeCol.indexOf(c) + (e.key === 'ArrowDown' ? 1 : -1)]
        })()
        break
      case 'ArrowRight':
        if (caretAuBord(c, 'fin')) {
          e.preventDefault()
          cible = voisin(racine, c, 1, 'ligne')
        }
        break
      case 'ArrowLeft':
        if (caretAuBord(c, 'debut')) {
          e.preventDefault()
          cible = voisin(racine, c, -1, 'ligne')
        }
        break
      default:
        return
    }
    aller(cible)
  }

  // Arrivée dans une case : tout sélectionner, pour que la frappe remplace la valeur. Au clavier
  // (Tab, Entrée, flèches) c'est immédiat ; au clic, on attend le relâchement du bouton, qui sinon
  // annulerait la sélection. Aucune sélection différée : une frappe rapide n'est jamais écrasée.
  let cliquee: HTMLInputElement | null = null
  function arrivee(e: FocusEvent) {
    const c = e.target
    if (c instanceof HTMLInputElement && c.matches(SELECTEUR)) c.select()
  }
  function appui(e: MouseEvent) {
    const c = e.target
    cliquee = c instanceof HTMLInputElement && c.matches(SELECTEUR) && document.activeElement !== c ? c : null
  }
  function relache(e: MouseEvent) {
    if (cliquee && e.target === cliquee && cliquee.selectionStart === cliquee.selectionEnd) cliquee.select()
    cliquee = null
  }

  racine.addEventListener('keydown', touche)
  racine.addEventListener('focusin', arrivee)
  racine.addEventListener('mousedown', appui)
  racine.addEventListener('mouseup', relache)
  return {
    update(nouvelles: OptionsGrille) {
      opts = nouvelles
    },
    destroy() {
      racine.removeEventListener('keydown', touche)
      racine.removeEventListener('focusin', arrivee)
      racine.removeEventListener('mousedown', appui)
      racine.removeEventListener('mouseup', relache)
    }
  }
}

/** Premier champ de la grille (ex. à l'ouverture d'une fenêtre de saisie). */
export function premierChamp(racine: HTMLElement | null | undefined, col?: string): boolean {
  if (!racine) return false
  const liste = champs(racine)
  return aller(col ? liste.find((c) => c.dataset.col === col) : liste[0])
}
