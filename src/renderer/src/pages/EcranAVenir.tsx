import { IconChevronGauche } from '../components/icons'
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
          <IconChevronGauche size={16} />
          Accueil
        </button>
        <h1>{entree.titre}</h1>
      </header>

      <div className="ecran-vide">
        <span className="ecran-vide-icone">
          <entree.Icone size={40} />
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
