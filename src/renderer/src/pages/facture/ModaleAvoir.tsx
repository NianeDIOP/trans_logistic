import { useState } from 'react'
import type { Facture } from '@shared/factures'
import { aujourdhui } from '../../../../core/facture'
import { formatMontant } from '../../../../core/montants'
import { Champ } from '../../components/ui/Champ'
import Modale from '../../components/ui/Modale'
import { useNotifier } from '../../components/ui/Notifications'
import { appel } from '../../lib/appel'

interface Props {
  facture: Facture
  onFermer: () => void
  onCree: (avoir: Facture) => void
}

export default function ModaleAvoir({ facture, onFermer, onCree }: Props): React.JSX.Element {
  const notifier = useNotifier()
  // L'avoir ne peut pas précéder la facture.
  const [date, setDate] = useState(() => (aujourdhui() < facture.date ? facture.date : aujourdhui()))
  const [motif, setMotif] = useState('')
  const [enCours, setEnCours] = useState(false)

  const creer = async (): Promise<void> => {
    setEnCours(true)
    try {
      const avoir = await appel(window.api.factures.creerAvoir(facture.id, { date, motif }))
      notifier(`Avoir ${avoir.numero} créé : la facture ${facture.numero} est annulée.`)
      onCree(avoir)
    } catch (err) {
      notifier((err as Error).message, 'erreur')
      setEnCours(false)
    }
  }

  return (
    <Modale
      titre="Annuler par un avoir"
      sousTitre={`Facture ${facture.numero} — ${formatMontant(facture.total_ttc)} FCFA`}
      onFermer={onFermer}
      onValider={() => void creer()}
      largeur={540}
      pied={
        <>
          <button type="button" className="btn btn-secondaire" onClick={onFermer} data-autofocus="">
            Annuler
          </button>
          <button type="submit" className="btn btn-danger" disabled={enCours}>
            Créer l’avoir
          </button>
        </>
      }
    >
      <div className="confirmation-texte avoir-explication">
        <p>
          Un avoir numéroté <strong>AV-…</strong> reprenant toutes les lignes et les montants de la facture va être
          émis, et la facture passera au statut <strong>Annulée</strong>.
        </p>
        <p className="texte-discret">Cette opération est définitive. Les règlements déjà reçus restent enregistrés.</p>
      </div>
      <div className="grille-champs">
        <Champ libelle="Date de l’avoir" obligatoire>
          {(id) => <input id={id} type="date" className="saisie" value={date} min={facture.date} onChange={(e) => setDate(e.target.value)} />}
        </Champ>
        <Champ libelle="Motif" className="pleine-largeur" aide="Figure sur l’avoir.">
          {(id) => (
            <textarea id={id} className="saisie" rows={2} placeholder="ex. Erreur de zone de livraison" value={motif} onChange={(e) => setMotif(e.target.value)} />
          )}
        </Champ>
      </div>
    </Modale>
  )
}
