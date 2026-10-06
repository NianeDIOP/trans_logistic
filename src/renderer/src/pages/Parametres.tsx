import { useCallback, useState } from 'react'
import {
  BuildingsIcon,
  CaretLeftIcon,
  DatabaseIcon,
  GearSixIcon,
  InfoIcon,
  ListBulletsIcon,
  PaletteIcon,
  MapTrifoldIcon,
  ReceiptIcon,
  UsersThreeIcon,
  type Icon
} from '@phosphor-icons/react'
import Confirmation from '../components/ui/Confirmation'
import OngletClients from './parametres/OngletClients'
import OngletEntreprise from './parametres/OngletEntreprise'
import OngletListes from './parametres/OngletListes'
import OngletPrestations from './parametres/OngletPrestations'
import OngletSauvegarde from './parametres/OngletSauvegarde'
import OngletAPropos from './parametres/OngletAPropos'
import OngletModeles from './parametres/OngletModeles'
import OngletZones from './parametres/OngletZones'

type Onglet = 'entreprise' | 'modeles' | 'clients' | 'zones' | 'prestations' | 'listes' | 'sauvegarde' | 'apropos'

const ONGLETS: { id: Onglet; titre: string; Icone: Icon }[] = [
  { id: 'entreprise', titre: 'Société', Icone: BuildingsIcon },
  { id: 'modeles', titre: 'Modèles de facture', Icone: PaletteIcon },
  { id: 'clients', titre: 'Clients', Icone: UsersThreeIcon },
  { id: 'zones', titre: 'Zones et tarifs', Icone: MapTrifoldIcon },
  { id: 'prestations', titre: 'Prestations', Icone: ReceiptIcon },
  { id: 'listes', titre: 'Listes', Icone: ListBulletsIcon },
  { id: 'sauvegarde', titre: 'Sauvegarde', Icone: DatabaseIcon },
  { id: 'apropos', titre: 'À propos', Icone: InfoIcon }
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
          {onglet === 'modeles' && <OngletModeles />}
          {onglet === 'clients' && <OngletClients />}
          {onglet === 'zones' && <OngletZones />}
          {onglet === 'prestations' && <OngletPrestations />}
          {onglet === 'listes' && <OngletListes />}
          {onglet === 'sauvegarde' && <OngletSauvegarde />}
          {onglet === 'apropos' && <OngletAPropos />}
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
