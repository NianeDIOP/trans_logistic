import Modale from './Modale'

interface Props {
  titre: string
  message: React.ReactNode
  libelleAction: string
  danger?: boolean
  onConfirmer: () => void
  onAnnuler: () => void
}

export default function Confirmation({
  titre,
  message,
  libelleAction,
  danger,
  onConfirmer,
  onAnnuler
}: Props): React.JSX.Element {
  return (
    <Modale
      titre={titre}
      onFermer={onAnnuler}
      onValider={onConfirmer}
      largeur={440}
      pied={
        <>
          {/* Pour une action destructrice, le choix par défaut est « Annuler ». */}
          <button type="button" className="btn btn-secondaire" onClick={onAnnuler} data-autofocus={danger ? '' : undefined}>
            Annuler
          </button>
          <button type="submit" className={`btn ${danger ? 'btn-danger' : 'btn-primaire'}`} data-autofocus={danger ? undefined : ''}>
            {libelleAction}
          </button>
        </>
      }
    >
      <div className="confirmation-texte">{message}</div>
    </Modale>
  )
}
