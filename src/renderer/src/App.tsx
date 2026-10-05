import { useCallback, useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import { FournisseurNotifications } from './components/ui/Notifications'
import Accueil from './pages/Accueil'
import EcranAVenir from './pages/EcranAVenir'
import Historique from './pages/Historique'
import NouvelleFacture from './pages/NouvelleFacture'
import Parametres from './pages/Parametres'
import { MENU, type Ecran } from './navigation'

/** Écran affiché et ses paramètres. */
export interface Route {
  ecran: Ecran
  /** Facture à ouvrir (brouillon à modifier ou facture émise à consulter). */
  factureId?: number
  /** Facture dont on reprend client et lignes dans une nouvelle facture. */
  dupliquerDe?: number
  /** Écran où revenir avec le bouton de retour. */
  retour?: Ecran
}

export default function App(): React.JSX.Element {
  const [route, setRoute] = useState<Route>({ ecran: 'accueil' })
  // Clé de rendu : rouvrir un écran repart d'un état neuf.
  const [cle, setCle] = useState(0)
  const naviguer = useCallback((r: Route) => {
    setRoute(r)
    setCle((c) => c + 1)
  }, [])
  const entree = MENU.find((m) => m.ecran === route.ecran)
  const accueil = useCallback(() => naviguer({ ecran: 'accueil' }), [naviguer])
  const retour = (): void => naviguer({ ecran: route.retour ?? 'accueil' })

  // Raccourcis clavier : Ctrl+N / H / T / , pour les modules, Échap pour revenir à l'accueil.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const modale = document.querySelector('.modale-fond')
      const protege = document.querySelector('[data-saisie-protegee]')
      // Échap revient à l'accueil depuis un écran de consultation ; jamais pendant une saisie.
      if (e.key === 'Escape') {
        const cible = e.target as HTMLElement
        if (!modale && !protege && !cible.closest('input, textarea, select, [role="dialog"]')) accueil()
        return
      }
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey || modale || protege) return
      const module = MENU.find((m) => m.touche === e.key.toUpperCase())
      if (module) {
        e.preventDefault()
        naviguer({ ecran: module.ecran })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [naviguer, accueil])

  const contenu = (): React.JSX.Element => {
    switch (route.ecran) {
      case 'accueil':
        return <Accueil onOuvrir={(ecran) => naviguer({ ecran })} />
      case 'parametres':
        return <Parametres onRetour={accueil} />
      case 'nouvelle-facture':
        return (
          <NouvelleFacture
            key={cle}
            factureId={route.factureId ?? null}
            dupliquerDe={route.dupliquerDe ?? null}
            libelleRetour={route.retour === 'historique' ? 'Historique' : 'Accueil'}
            onRetour={retour}
            onOuvrir={(r) => naviguer({ ecran: 'nouvelle-facture', retour: route.retour, ...r })}
          />
        )
      case 'historique':
        return (
          <Historique
            key={cle}
            onRetour={accueil}
            onOuvrir={(factureId) => naviguer({ ecran: 'nouvelle-facture', factureId, retour: 'historique' })}
            onDupliquer={(dupliquerDe) => naviguer({ ecran: 'nouvelle-facture', dupliquerDe, retour: 'historique' })}
          />
        )
      default:
        return <EcranAVenir entree={entree!} onRetour={accueil} />
    }
  }

  return (
    <FournisseurNotifications>
      <div className="app">
        <TitleBar contexte={route.retour === 'historique' ? 'Historique' : entree?.titre} />
        <main className="app-contenu">{contenu()}</main>
      </div>
    </FournisseurNotifications>
  )
}
