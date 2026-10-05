import { useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Accueil from './pages/Accueil'
import EcranAVenir from './pages/EcranAVenir'
import { MENU, type Ecran } from './navigation'

export default function App(): React.JSX.Element {
  const [ecran, setEcran] = useState<Ecran>('accueil')
  const entree = MENU.find((m) => m.ecran === ecran)

  // Raccourcis clavier : Ctrl+N / H / T / P pour les modules, Échap pour revenir à l'accueil.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setEcran('accueil')
        return
      }
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
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
    <div className="app">
      <TitleBar contexte={entree?.titre} />
      <main className="app-contenu">
        {entree ? (
          <EcranAVenir entree={entree} onRetour={() => setEcran('accueil')} />
        ) : (
          <Accueil onOuvrir={setEcran} />
        )}
      </main>
    </div>
  )
}
