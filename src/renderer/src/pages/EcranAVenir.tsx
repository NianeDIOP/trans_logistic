import { CaretLeftIcon } from '@phosphor-icons/react'
import type { EntreeMenu } from '../navigation'

interface Props {
  entree: EntreeMenu
  onRetour: () => void
}

/** Écran provisoire affiché tant que le module n'est pas livré. */
export default function EcranAVenir({ entree, onRetour }: Props): React.JSX.Element {
  return (
    <div className="ecran">
      <header className="ecran-entete">
        <button className="bouton-retour" onClick={onRetour}>
          <CaretLeftIcon size={16} weight="bold" />
          Accueil
        </button>
        <span className="ecran-entete-icone">
          <entree.Icone size={22} weight="duotone" />
        </span>
        <h1>{entree.titre}</h1>
      </header>

      <div className="ecran-vide">
        <span className="module-icone module-icone-grande">
          <entree.Icone size={44} weight="duotone" />
        </span>
        <h2>Module en préparation</h2>
        <p>
          {entree.description}
          <br />
          Ce module sera livré à la phase {entree.phase} du projet.
        </p>
        <p className="ecran-vide-aide">
          <kbd>Échap</kbd> pour revenir à l'accueil
        </p>
      </div>
    </div>
  )
}
