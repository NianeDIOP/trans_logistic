import type { EntreeMenu } from '../navigation'

interface Props {
  entree: EntreeMenu
  onRetour: () => void
}

/** Écran provisoire affiché tant que la fonctionnalité n'est pas réalisée. */
export default function EcranAVenir({ entree, onRetour }: Props): React.JSX.Element {
  return (
    <div className="ecran">
      <header className="ecran-entete">
        <button className="bouton-retour" onClick={onRetour}>
          ← Accueil
        </button>
        <h1>{entree.titre}</h1>
      </header>
      <div className="a-venir">
        <span className="menu-icone" aria-hidden="true">
          {entree.icone}
        </span>
        <p>Cet écran sera disponible prochainement (phase {entree.phase}).</p>
      </div>
    </div>
  )
}
