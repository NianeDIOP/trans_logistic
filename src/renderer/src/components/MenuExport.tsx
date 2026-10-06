import { useEffect, useRef, useState } from 'react'
import { CaretDownIcon, FileCsvIcon } from '@phosphor-icons/react'
import type { Reponse } from '@shared/types'
import { useNotifier } from './ui/Notifications'
import { appel } from '../lib/appel'

export interface ChoixExport<G extends string> {
  genre: G
  libelle: string
  detail: string
}

interface Props<G extends string> {
  choix: ChoixExport<G>[]
  /** Lance l'export ; retourne le chemin du fichier, ou null si l'utilisateur a annulé. */
  exporter: (genre: G) => Promise<Reponse<string | null>>
}

/** Bouton « Exporter » avec la liste des exports CSV proposés. */
export default function MenuExport<G extends string>({ choix, exporter }: Props<G>): React.JSX.Element {
  const notifier = useNotifier()
  const [ouvert, setOuvert] = useState(false)
  const [enCours, setEnCours] = useState(false)
  const racine = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ouvert) return
    const fermerSiDehors = (e: MouseEvent): void => {
      if (!racine.current?.contains(e.target as Node)) setOuvert(false)
    }
    const fermerSurEchap = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOuvert(false)
    }
    document.addEventListener('mousedown', fermerSiDehors)
    document.addEventListener('keydown', fermerSurEchap)
    return () => {
      document.removeEventListener('mousedown', fermerSiDehors)
      document.removeEventListener('keydown', fermerSurEchap)
    }
  }, [ouvert])

  const lancer = async (genre: G): Promise<void> => {
    setOuvert(false)
    setEnCours(true)
    try {
      const chemin = await appel(exporter(genre))
      if (chemin) {
        notifier(`Export enregistré : ${chemin.split(/[\\/]/).pop()}`)
        void appel(window.api.exports.afficher(chemin)).catch(() => undefined)
      }
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="menu-export" ref={racine}>
      <button
        type="button"
        className="btn btn-secondaire"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        disabled={enCours}
        onClick={() => setOuvert((o) => !o)}
      >
        <FileCsvIcon size={18} weight="duotone" />
        {enCours ? 'Export…' : 'Exporter'}
        <CaretDownIcon size={12} weight="bold" />
      </button>
      {ouvert && (
        <ul className="menu-export-liste" role="menu">
          {choix.map((c) => (
            <li key={c.genre} role="none">
              <button type="button" role="menuitem" onClick={() => void lancer(c.genre)}>
                <strong>{c.libelle}</strong>
                <span>{c.detail}</span>
              </button>
            </li>
          ))}
          <li className="menu-export-note" role="none">
            Fichier CSV, s’ouvre dans Excel
          </li>
        </ul>
      )}
    </div>
  )
}
