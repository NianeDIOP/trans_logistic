import { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Accueil from './pages/Accueil'
import EcranAVenir from './pages/EcranAVenir'
import Parametres from './pages/Parametres'
import { FournisseurNotifications } from './components/ui/Notifications'
import { MENU, type Ecran } from './navigation'

export default function App(): React.JSX.Element {
  const [ecran, setEcran] = useState<Ecran>('accueil')
  const entree = MENU.find((m) => m.ecran === ecran)

  // Raccourcis clavier : Ctrl+N / H / T / , pour les modules, Échap pour revenir à l'accueil.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      // Échap revient à l'accueil depuis un écran provisoire ; jamais pendant une saisie.
      if (e.key === 'Escape') {
        const cible = e.target as HTMLElement
        const enSaisie = cible.closest('input, textarea, select, [role="dialog"]')
        if (!enSaisie && !document.querySelector('.modale-fond')) {
          setEcran((courant) => (courant === 'parametres' ? courant : 'accueil'))
        }
        return
      }
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
      if (document.querySelector('.modale-fond')) return
      const cible = MENU.find((m) => m.touche === e.key.toUpperCase())
      if (cible) {
        e.preventDefault()
        setEcran(cible.ecran)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <FournisseurNotifications>
      <div className="app">
        <TitleBar contexte={entree?.titre} />
        <main className="app-contenu">
          {ecran === 'parametres' ? (
            <Parametres onRetour={() => setEcran('accueil')} />
          ) : entree ? (
            <EcranAVenir entree={entree} onRetour={() => setEcran('accueil')} />
          ) : (
            <Accueil onOuvrir={setEcran} />
          )}
        </main>
      </div>
    </FournisseurNotifications>
  )
}
