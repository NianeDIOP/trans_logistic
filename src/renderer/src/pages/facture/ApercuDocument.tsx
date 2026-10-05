import { useRef } from 'react'

interface Props {
  html: string
  titre?: string
}

/** Feuille A4 rendue à partir du HTML de la facture (iframe sans script). */
export default function ApercuDocument({ html, titre = 'Aperçu de la facture' }: Props): React.JSX.Element {
  const cadre = useRef<HTMLIFrameElement>(null)
  return (
    <div className="apercu-feuille">
      <iframe
        ref={cadre}
        title={titre}
        srcDoc={html}
        sandbox="allow-same-origin"
        onLoad={() => {
          const doc = cadre.current?.contentDocument
          if (doc && cadre.current) cadre.current.style.height = `${doc.documentElement.scrollHeight}px`
        }}
      />
    </div>
  )
}
