import { useEffect, useState } from 'react'
import { CheckIcon, FloppyDiskIcon } from '@phosphor-icons/react'
import { MODELES_FACTURE, THEMES_FACTURE } from '@shared/modeles'
import EnTeteSection from '../../components/ui/EnTeteSection'
import { useNotifier } from '../../components/ui/Notifications'
import { appel } from '../../lib/appel'
import ApercuDocument from '../facture/ApercuDocument'

/** Choix de la mise en page et du thème de couleurs des factures, avec aperçu en direct. */
export default function OngletModeles(): React.JSX.Element {
  const notifier = useNotifier()
  const [initial, setInitial] = useState<{ modele: string; theme: string } | null>(null)
  const [modele, setModele] = useState('classique')
  const [theme, setTheme] = useState('marque')
  const [miniatures, setMiniatures] = useState<Record<string, string>>({})
  const [apercu, setApercu] = useState<string | null>(null)

  useEffect(() => {
    appel(window.api.parametres.entreprise.lire())
      .then((e) => {
        setInitial({ modele: e.modele_facture, theme: e.theme_facture })
        setModele(e.modele_facture)
        setTheme(e.theme_facture)
      })
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [notifier])

  // Miniatures des mises en page dans le thème choisi.
  useEffect(() => {
    if (!initial) return
    void Promise.all(
      MODELES_FACTURE.map(async (m) => [m.id, await appel(window.api.parametres.entreprise.apercuModele(m.id, theme))] as const)
    )
      .then((r) => setMiniatures(Object.fromEntries(r)))
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [theme, initial, notifier])

  // Grand aperçu de la combinaison choisie.
  useEffect(() => {
    if (!initial) return
    appel(window.api.parametres.entreprise.apercuModele(modele, theme))
      .then(setApercu)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [modele, theme, initial, notifier])

  const modifie = initial !== null && (initial.modele !== modele || initial.theme !== theme)

  const enregistrer = async (): Promise<void> => {
    try {
      const e = await appel(window.api.parametres.entreprise.definirPresentation(modele, theme))
      setInitial({ modele: e.modele_facture, theme: e.theme_facture })
      notifier('Modèle de facture enregistré : il s’applique aux prochains PDF.')
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    }
  }

  return (
    <div className="onglet onglet-large">
      <EnTeteSection
        titre="Modèles de facture"
        description="Choisissez la mise en page et les couleurs de vos factures et avoirs (PDF, impression, aperçu)."
        actions={
          <>
            {modifie && <span className="texte-modifie">Modifications non enregistrées</span>}
            <button className="btn btn-primaire" disabled={!modifie} onClick={() => void enregistrer()}>
              <FloppyDiskIcon size={18} weight="duotone" />
              Enregistrer
            </button>
          </>
        }
      />

      <div className="modeles">
        <div className="modeles-choix">
          <section className="carte">
            <h3 className="carte-titre">Mise en page</h3>
            <div className="galerie-modeles">
              {MODELES_FACTURE.map((m) => (
                <button key={m.id} className={`vignette ${modele === m.id ? 'choisie' : ''}`} onClick={() => setModele(m.id)}>
                  <span className="vignette-image">{miniatures[m.id] && <ApercuDocument html={miniatures[m.id]} titre={m.nom} />}</span>
                  <span className="vignette-nom">
                    {modele === m.id && <CheckIcon size={14} weight="bold" />}
                    {m.nom}
                  </span>
                  <span className="vignette-description">{m.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="carte">
            <h3 className="carte-titre">Couleurs</h3>
            <div className="galerie-themes">
              {THEMES_FACTURE.map((t) => (
                <button key={t.id} className={`theme ${theme === t.id ? 'choisi' : ''}`} onClick={() => setTheme(t.id)} title={t.nom}>
                  <span className="theme-pastille" style={{ background: `linear-gradient(135deg, ${t.principal} 0 58%, ${t.accent} 58% 100%)` }}>
                    {theme === t.id && <CheckIcon size={16} weight="bold" />}
                  </span>
                  <span className="theme-nom">{t.nom}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="carte modeles-apercu">
          <h3 className="carte-titre">Aperçu</h3>
          {apercu && <ApercuDocument html={apercu} titre="Aperçu du modèle" />}
        </section>
      </div>
    </div>
  )
}
