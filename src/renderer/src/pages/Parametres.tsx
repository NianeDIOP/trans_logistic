import { useCallback, useState } from 'react'
import {
  BuildingsIcon,
  CaretLeftIcon,
  DatabaseIcon,
  GearSixIcon,
  ListBulletsIcon,
  MapTrifoldIcon,
  ReceiptIcon,
  UsersThreeIcon,
  type Icon
} from '@phosphor-icons/react'
import Confirmation from '../components/ui/Confirmation'
import EnTeteSection from '../components/ui/EnTeteSection'
import OngletClients from './parametres/OngletClients'
import OngletEntreprise from './parametres/OngletEntreprise'
import OngletListes from './parametres/OngletListes'
import OngletPrestations from './parametres/OngletPrestations'
import OngletZones from './parametres/OngletZones'

type Onglet = 'entreprise' | 'clients' | 'zones' | 'prestations' | 'listes' | 'sauvegarde'

const ONGLETS: { id: Onglet; titre: string; Icone: Icon }[] = [
  { id: 'entreprise', titre: 'Société', Icone: BuildingsIcon },
  { id: 'clients', titre: 'Clients', Icone: UsersThreeIcon },
  { id: 'zones', titre: 'Zones et tarifs', Icone: MapTrifoldIcon },
  { id: 'prestations', titre: 'Prestations', Icone: ReceiptIcon },
  { id: 'listes', titre: 'Listes', Icone: ListBulletsIcon },
  { id: 'sauvegarde', titre: 'Sauvegarde', Icone: DatabaseIcon }
]

interface Props {
  onRetour: () => void
}

export default function Parametres({ onRetour }: Props): React.JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('entreprise')
  const [nonEnregistre, setNonEnregistre] = useState(false)
  const [aConfirmer, setAConfirmer] = useState<(() => void) | null>(null)
  const surModification = useCallback((m: boolean) => setNonEnregistre(m), [])

  /** Quitte l'onglet Société en demandant confirmation s'il reste des modifications. */
  const quitter = (action: () => void): void => {
    if (onglet === 'entreprise' && nonEnregistre) setAConfirmer(() => action)
    else action()
  }

  return (
    <div className="ecran" data-saisie-protegee>
      <header className="ecran-entete">
        <button className="bouton-retour" onClick={() => quitter(onRetour)}>
          <CaretLeftIcon size={16} weight="bold" />
          Accueil
        </button>
        <span className="ecran-entete-icone">
          <GearSixIcon size={22} weight="duotone" />
        </span>
        <h1>Paramètres</h1>
      </header>

      <div className="parametres">
        <nav className="parametres-nav" aria-label="Rubriques des paramètres">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              className={`parametres-lien ${onglet === o.id ? 'actif' : ''}`}
              aria-current={onglet === o.id ? 'page' : undefined}
              onClick={() =>
                quitter(() => {
                  setNonEnregistre(false)
                  setOnglet(o.id)
                })
              }
            >
              <o.Icone size={20} weight={onglet === o.id ? 'fill' : 'duotone'} />
              {o.titre}
            </button>
          ))}
        </nav>

        <div className="parametres-contenu">
          {onglet === 'entreprise' && <OngletEntreprise onModifie={surModification} />}
          {onglet === 'clients' && <OngletClients />}
          {onglet === 'zones' && <OngletZones />}
          {onglet === 'prestations' && <OngletPrestations />}
          {onglet === 'listes' && <OngletListes />}
          {onglet === 'sauvegarde' && (
            <div className="onglet">
              <EnTeteSection
                titre="Sauvegarde et restauration"
                description="Copie de la base de factures vers un dossier de votre choix (clé USB, disque externe…)."
              />
              <div className="carte vide">
                <DatabaseIcon size={40} weight="duotone" />
                <p>Cette fonction sera livrée à la phase 7 du projet.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {aConfirmer && (
        <Confirmation
          titre="Modifications non enregistrées"
          message={<p>Les informations de la société ont été modifiées sans être enregistrées. Quitter quand même ?</p>}
          libelleAction="Quitter sans enregistrer"
          danger
          onConfirmer={() => {
            const action = aConfirmer
            setAConfirmer(null)
            setNonEnregistre(false)
            action()
          }}
          onAnnuler={() => setAConfirmer(null)}
        />
      )}
    </div>
  )
}
