import { useEffect, useState } from 'react'
import {
  ArrowRightIcon,
  CalendarBlankIcon,
  DatabaseIcon,
  EnvelopeSimpleIcon,
  MapPinIcon,
  PhoneIcon
} from '@phosphor-icons/react'
import type { AppInfo, Entreprise } from '@shared/types'
import logo from '../assets/logo-2m.png'
import { MENU, type Ecran } from '../navigation'

interface Props {
  onOuvrir: (ecran: Ecran) => void
}

const formatDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})

export default function Accueil({ onOuvrir }: Props): React.JSX.Element {
  const [entreprise, setEntreprise] = useState<Entreprise | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([window.api.getEntreprise(), window.api.getAppInfo()])
      .then(([e, i]) => {
        setEntreprise(e)
        setInfo(i)
      })
      .catch((err: Error) => setErreur(err.message))
  }, [])

  return (
    <div className="accueil">
      <section className="bandeau">
        <img className="bandeau-logo" src={logo} alt="2M Logistique Transport" draggable={false} />

        <div className="bandeau-infos">
          <p className="bandeau-date">
            <CalendarBlankIcon size={18} weight="duotone" />
            <span>{formatDate.format(new Date())}</span>
          </p>
          <h1>Facturation</h1>
          <p className="bandeau-accroche">Transport et logistique de conteneurs</p>

          {entreprise && (
            <ul className="bandeau-contacts">
              <li>
                <MapPinIcon size={16} weight="duotone" />
                {entreprise.adresse} · Siège opérationnel : {entreprise.siege}
              </li>
              <li>
                <PhoneIcon size={16} weight="duotone" />
                {entreprise.tel}
              </li>
              <li>
                <EnvelopeSimpleIcon size={16} weight="duotone" />
                {entreprise.email}
              </li>
            </ul>
          )}
        </div>
      </section>

      <div className="accueil-corps">
        {erreur && (
          <p className="alerte" role="alert">
            Impossible de lire la base de données : {erreur}
          </p>
        )}

        <h2 className="titre-section">Modules</h2>

        <nav className="modules" aria-label="Modules">
          {MENU.map((m) => (
            <button key={m.ecran} className="module" onClick={() => onOuvrir(m.ecran)}>
              <span className="module-icone">
                <m.Icone size={30} weight="duotone" />
              </span>
              <span className="module-titre">{m.titre}</span>
              <span className="module-description">{m.description}</span>
              <span className="module-bas">
                <span className="module-ouvrir">
                  Ouvrir
                  <ArrowRightIcon size={16} weight="bold" className="module-fleche" />
                </span>
                <span className="module-raccourci">
                  <kbd>Ctrl</kbd>
                  <kbd>{m.touche}</kbd>
                </span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <footer className="statut">
        <span className="statut-base">
          <DatabaseIcon size={15} weight="duotone" />
          Données enregistrées sur cet ordinateur
        </span>
        {entreprise && (
          <span>
            RC {entreprise.rc} · NINEA {entreprise.ninea}
          </span>
        )}
        {info && (
          <span>
            Version {info.version} · schéma {info.schemaVersion}
          </span>
        )}
      </footer>
    </div>
  )
}
