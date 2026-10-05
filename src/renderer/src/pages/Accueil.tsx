import { useEffect, useState } from 'react'
import type { AppInfo, Entreprise } from '@shared/types'
import { MENU, type Ecran } from '../navigation'

interface Props {
  onOuvrir: (ecran: Ecran) => void
}

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
      <header className="accueil-entete">
        <h1>{entreprise?.raison_sociale ?? '2M LOGISTIQUE ET TRANSPORT'}</h1>
        <p className="sous-titre">Facturation du transport de conteneurs</p>
      </header>

      {erreur && <p className="erreur">Erreur : {erreur}</p>}

      <nav className="menu-grille">
        {MENU.map((m) => (
          <button key={m.ecran} className="menu-bouton" onClick={() => onOuvrir(m.ecran)}>
            <span className="menu-icone" aria-hidden="true">
              {m.icone}
            </span>
            <span className="menu-titre">{m.titre}</span>
            <span className="menu-description">{m.description}</span>
          </button>
        ))}
      </nav>

      <footer className="accueil-pied">
        {entreprise && (
          <span>
            RC : {entreprise.rc} · NINEA : {entreprise.ninea} · {entreprise.tel}
          </span>
        )}
        {info && (
          <span className="version">
            Version {info.version} · schéma {info.schemaVersion}
          </span>
        )}
      </footer>
    </div>
  )
}
