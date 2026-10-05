import { useEffect, useState } from 'react'
import Logo from './Logo'
import { GlyphAgrandir, GlyphFermer, GlyphReduire, GlyphRestaurer } from './icons'

interface Props {
  /** Fil d'Ariane affiché après le nom de l'application. */
  contexte?: string
}

/** Barre de titre de l'application (remplace celle de Windows). */
export default function TitleBar({ contexte }: Props): React.JSX.Element {
  const [agrandie, setAgrandie] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then(setAgrandie)
    return window.api.window.onMaximizedChange(setAgrandie)
  }, [])

  return (
    <header className="titlebar" onDoubleClick={() => window.api.window.toggleMaximize()}>
      <div className="titlebar-marque">
        <Logo size={18} variante="trait" />
        <span className="titlebar-nom">2M Facturation</span>
        {contexte && (
          <>
            <span className="titlebar-sep" aria-hidden="true">
              /
            </span>
            <span className="titlebar-contexte">{contexte}</span>
          </>
        )}
      </div>

      <div className="titlebar-controles" onDoubleClick={(e) => e.stopPropagation()}>
        <button
          className="titlebar-bouton"
          title="Réduire"
          aria-label="Réduire"
          onClick={() => window.api.window.minimize()}
        >
          <GlyphReduire />
        </button>
        <button
          className="titlebar-bouton"
          title={agrandie ? 'Restaurer' : 'Agrandir'}
          aria-label={agrandie ? 'Restaurer' : 'Agrandir'}
          onClick={() => window.api.window.toggleMaximize()}
        >
          {agrandie ? <GlyphRestaurer /> : <GlyphAgrandir />}
        </button>
        <button
          className="titlebar-bouton titlebar-fermer"
          title="Fermer"
          aria-label="Fermer"
          onClick={() => window.api.window.close()}
        >
          <GlyphFermer />
        </button>
      </div>
    </header>
  )
}
