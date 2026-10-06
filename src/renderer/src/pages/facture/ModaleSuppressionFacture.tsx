import { useState } from 'react'
import { WarningIcon } from '@phosphor-icons/react'
import Modale from '../../components/ui/Modale'
import { useNotifier } from '../../components/ui/Notifications'
import { appel } from '../../lib/appel'

interface Props {
  facture: { id: number; numero: string | null; type: 'facture' | 'avoir'; client: string }
  onFermer: () => void
  onSupprimee: () => void
}

/** Suppression définitive d'une facture ou d'un avoir, confirmée en retapant son numéro. */
export default function ModaleSuppressionFacture({ facture, onFermer, onSupprimee }: Props): React.JSX.Element {
  const notifier = useNotifier()
  const [saisie, setSaisie] = useState('')
  const numero = facture.numero ?? ''
  const nom = facture.type === 'avoir' ? 'l’avoir' : 'la facture'
  const ok = saisie.trim().toUpperCase() === numero.toUpperCase()

  const supprimer = async (): Promise<void> => {
    if (!ok) return
    try {
      const r = await appel(window.api.factures.supprimer(facture.id))
      notifier(
        r.trou
          ? `${numero} supprimé. Attention : la numérotation présente désormais un trou.`
          : `${numero} supprimé ; ce numéro sera réattribué à la prochaine facture.`
      )
      onSupprimee()
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    }
  }

  return (
    <Modale
      titre={`Supprimer ${nom} ${numero}`}
      sousTitre={facture.client}
      onFermer={onFermer}
      onValider={() => void supprimer()}
      largeur={520}
      pied={
        <>
          <button type="button" className="btn btn-secondaire" onClick={onFermer} data-autofocus="">
            Annuler
          </button>
          <button type="submit" className="btn btn-danger" disabled={!ok}>
            Supprimer définitivement
          </button>
        </>
      }
    >
      <div className="confirmation-texte">
        <p className="avertissement">
          <WarningIcon size={18} weight="fill" />
          Suppression définitive : {nom}, ses lignes, ses règlements et son PDF archivé seront effacés.
        </p>
        <p className="texte-discret">
          Pour annuler une facture en gardant une trace comptable, préférez « Annuler par un avoir ». Supprimer une
          facture qui n’est pas la dernière laisse un trou dans la numérotation.
        </p>
        <label className="champ">
          <span>
            Pour confirmer, tapez <strong>{numero}</strong>
          </span>
          <input className="saisie" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder={numero} />
        </label>
      </div>
    </Modale>
  )
}
