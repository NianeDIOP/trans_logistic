import { useEffect, useState } from 'react'
import type { AppInfo, Entreprise } from '@shared/types'
import Logo from '../components/Logo'
import { IconBaseLocale, IconFlecheDroite } from '../components/icons'
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
      <aside className="identite">
        <div className="identite-haut">
          <Logo size={56} variante="trait" />
          <p className="identite-raison">{entreprise?.raison_sociale ?? '2M Logistique et Transport'}</p>
          <p className="identite-activite">Transport et logistique de conteneurs</p>
        </div>

        <p className="identite-date">{formatDate.format(new Date())}</p>

        {entreprise && (
          <dl className="identite-legal">
            <div>
              <dt>RC</dt>
              <dd>{entreprise.rc}</dd>
            </div>
            <div>
              <dt>NINEA</dt>
              <dd>{entreprise.ninea}</dd>
            </div>
            <div>
              <dt>Siège</dt>
              <dd>{entreprise.siege}</dd>
            </div>
            <div>
              <dt>Tél.</dt>
              <dd>{entreprise.tel}</dd>
            </div>
          </dl>
        )}
      </aside>

      <section className="espace">
        <header className="espace-entete">
          <p className="surtitre">Espace de travail</p>
          <h1>Facturation</h1>
        </header>

        {erreur && (
          <p className="alerte" role="alert">
            Impossible de lire la base de données : {erreur}
          </p>
        )}

        <nav className="modules" aria-label="Modules">
          {MENU.map((m, i) => (
            <button key={m.ecran} className="module" onClick={() => onOuvrir(m.ecran)}>
              <span className="module-haut">
                <span className="module-icone">
                  <m.Icone size={28} />
                </span>
                <span className="module-numero">{String(i + 1).padStart(2, '0')}</span>
              </span>
              <span className="module-titre">{m.titre}</span>
              <span className="module-description">{m.description}</span>
              <span className="module-bas">
                <kbd>Ctrl</kbd>
                <kbd>{m.touche}</kbd>
                <IconFlecheDroite size={18} className="module-fleche" />
              </span>
            </button>
          ))}
        </nav>

        <footer className="statut">
          <span className="statut-base">
            <IconBaseLocale size={14} />
            Données enregistrées sur cet ordinateur
          </span>
          {info && (
            <span className="statut-version">
              v{info.version} · schéma {info.schemaVersion}
            </span>
          )}
        </footer>
      </section>
    </div>
  )
}
