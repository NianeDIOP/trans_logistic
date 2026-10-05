import { useState } from 'react'
import Accueil from './pages/Accueil'
import EcranAVenir from './pages/EcranAVenir'
import { MENU, type Ecran } from './navigation'

export default function App(): React.JSX.Element {
  const [ecran, setEcran] = useState<Ecran>('accueil')

  if (ecran === 'accueil') {
    return <Accueil onOuvrir={setEcran} />
  }

  const entree = MENU.find((m) => m.ecran === ecran)!
  return <EcranAVenir entree={entree} onRetour={() => setEcran('accueil')} />
}
