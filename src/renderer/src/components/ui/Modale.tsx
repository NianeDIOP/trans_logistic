import { useEffect, useRef } from 'react'
import { XIcon } from '@phosphor-icons/react'

interface Props {
  titre: string
  sousTitre?: string
  onFermer: () => void
  children: React.ReactNode
  pied?: React.ReactNode
  largeur?: number
  /** Soumission du formulaire (touche Entrée). */
  onValider?: () => void
}

/** Fenêtre de dialogue. Échap ferme ; Entrée valide le formulaire. */
export default function Modale({
  titre,
  sousTitre,
  onFermer,
  children,
  pied,
  largeur = 520,
  onValider
}: Props): React.JSX.Element {
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    // Focus sur le premier champ, sinon sur le bouton marqué `data-autofocus`.
    const premier =
      ref.current?.querySelector<HTMLElement>('input, select, textarea') ??
      ref.current?.querySelector<HTMLElement>('[data-autofocus]')
    premier?.focus()
  }, [])

  return (
    <div className="modale-fond" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <form
        ref={ref}
        className="modale"
        style={{ width: largeur }}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onFermer()
          }
          // Entrée valide aussi depuis un bouton de choix (sinon elle le réactiverait).
          if (e.key === 'Enter' && (e.target as HTMLElement).getAttribute('role') === 'radio') {
            e.preventDefault()
            onValider?.()
          }
        }}
        onSubmit={(e) => {
          e.preventDefault()
          onValider?.()
        }}
      >
        <header className="modale-entete">
          <div>
            <h2>{titre}</h2>
            {sousTitre && <p>{sousTitre}</p>}
          </div>
          <button type="button" className="btn-icone" aria-label="Fermer" onClick={onFermer}>
            <XIcon size={18} />
          </button>
        </header>
        <div className="modale-corps">{children}</div>
        {pied && <footer className="modale-pied">{pied}</footer>}
      </form>
    </div>
  )
}
