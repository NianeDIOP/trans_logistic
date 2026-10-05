import { useEffect, useRef, useState } from 'react'

interface Props {
  html: string
  titre?: string
  /** Affiche les boutons de zoom « Largeur » / « Page entière ». */
  zoom?: boolean
}

/** Dimensions d'une page A4 à 96 ppp (210 × 297 mm). */
const LARGEUR_A4 = 794
const HAUTEUR_A4 = 1123

/**
 * Feuille A4 rendue à partir du HTML de la facture (iframe sans script),
 * réduite proportionnellement pour tenir dans la largeur disponible, comme dans un lecteur PDF.
 */
export default function ApercuDocument({ html, titre = 'Aperçu de la facture', zoom = false }: Props): React.JSX.Element {
  // « Largeur » : lisible, la page défile ; « Page entière » : toute la première page d'un coup d'œil.
  const [pageEntiere, setPageEntiere] = useState(false)
  const conteneur = useRef<HTMLDivElement>(null)
  const cadre = useRef<HTMLIFrameElement>(null)
  const [echelle, setEchelle] = useState(1)
  const [hauteur, setHauteur] = useState(HAUTEUR_A4)

  // Échelle recalculée à chaque changement de taille de la fenêtre ou du panneau.
  useEffect(() => {
    const el = conteneur.current
    if (!el) return
    const mesurer = (): void => {
      let e = Math.min(1, el.clientWidth / LARGEUR_A4)
      if (pageEntiere) {
        const zone = el.closest('.apercu-feuille') as HTMLElement | null
        const disponible = (zone?.clientHeight ?? window.innerHeight) - 44
        e = Math.min(e, disponible / HAUTEUR_A4)
      }
      setEchelle(Math.max(0.15, e))
    }
    mesurer()
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(el)
    return () => observateur.disconnect()
  }, [pageEntiere, zoom])

  const ajusterHauteur = (): void => {
    const doc = cadre.current?.contentDocument
    if (doc) setHauteur(Math.max(HAUTEUR_A4, doc.documentElement.scrollHeight))
  }

  const page = (
    <div className="apercu-feuille">
      <div ref={conteneur} className="apercu-mesure">
        <div className="apercu-page" style={{ width: LARGEUR_A4 * echelle, height: hauteur * echelle }}>
          <iframe
            ref={cadre}
            title={titre}
            srcDoc={html}
            sandbox="allow-same-origin"
            style={{ width: LARGEUR_A4, height: hauteur, transform: `scale(${echelle})` }}
            onLoad={() => {
              ajusterHauteur()
              // Les polices et le logo peuvent finir de charger après l'événement : on remesure.
              const doc = cadre.current?.contentDocument
              void doc?.fonts?.ready.then(ajusterHauteur)
              setTimeout(ajusterHauteur, 300)
            }}
          />
        </div>
      </div>
    </div>
  )

  if (!zoom) return page
  return (
    <div className="apercu-zoomable">
      <div className="apercu-barre">
        <div className="segments" role="group" aria-label="Zoom">
          <button type="button" className={pageEntiere ? '' : 'actif'} onClick={() => setPageEntiere(false)}>
            Largeur
          </button>
          <button type="button" className={pageEntiere ? 'actif' : ''} onClick={() => setPageEntiere(true)}>
            Page entière
          </button>
        </div>
      </div>
      {page}
    </div>
  )
}
