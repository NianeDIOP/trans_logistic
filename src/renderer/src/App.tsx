import { useCallback, useEffect, useState } from 'react'
import TitleBar from './components/TitleBar'
import Accueil from './pages/Accueil'
import EcranAVenir from './pages/EcranAVenir'
import NouvelleFacture from './pages/NouvelleFacture'
import Parametres from './pages/Parametres'
import { FournisseurNotifications } from './components/ui/Notifications'
import { MENU, type Ecran } from './navigation'

export default function App(): React.JSX.Element {
  const [ecran, setEcranBrut] = useState<Ecran>('accueil')
  // Clé de rendu : rouvrir un écran repart d'un état neuf (ex. Ctrl+N depuis une facture).
  const [cle, setCle] = useState(0)
  const setEcran = useCallback((e: Ecran | ((courant: Ecran) => Ecran)) => {
    setEcranBrut(e)
    setCle((c) => c + 1)
  }, [])
  const entree = MENU.find((m) => m.ecran === ecran)

  // Raccourcis clavier : Ctrl+N / H / T / , pour les modules, Échap pour revenir à l'accueil.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      // Échap revient à l'accueil depuis un écran provisoire ; jamais pendant une saisie.
      if (e.key === 'Escape') {
        const cible = e.target as HTMLElement
        const enSaisie = cible.closest('input, textarea, select, [role="dialog"]')
        if (!enSaisie && !document.querySelector('.modale-fond')) {
          setEcranBrut((courant) => (courant === 'parametres' || courant === 'nouvelle-facture' ? courant : 'accueil'))
        }
        return
      }
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
      if (document.querySelector('.modale-fond')) return
      // Pas de raccourci de navigation depuis un écran de saisie : on le quitte par « Accueil »
      // (qui demande confirmation s'il reste des modifications).
      if (document.querySelector('[data-saisie-protegee]')) return
      const cible = MENU.find((m) => m.touche === e.key.toUpperCase())
      if (cible) {
        e.preventDefault()
        setEcran(cible.ecran)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setEcran])

  return (
    <FournisseurNotifications>
      <div className="app">
        <TitleBar contexte={entree?.titre} />
        <main className="app-contenu">
          {ecran === 'parametres' ? (
            <Parametres onRetour={() => setEcran('accueil')} />
          ) : ecran === 'nouvelle-facture' ? (
            <NouvelleFacture key={cle} onRetour={() => setEcran('accueil')} />
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
