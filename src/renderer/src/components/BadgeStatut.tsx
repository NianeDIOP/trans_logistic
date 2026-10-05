import type { Facture } from '@shared/factures'
import type { ResumeFacture } from '@shared/historique'
import { LIBELLES_STATUT } from '../../../core/paiements'

type Props = { facture: Pick<Facture | ResumeFacture, 'type' | 'statut'> }

/** Statut d'une facture ; un avoir est signalé comme tel. */
export default function BadgeStatut({ facture }: Props): React.JSX.Element {
  if (facture.type === 'avoir' && facture.statut !== 'brouillon') {
    return <span className="badge badge-avoir">Avoir</span>
  }
  return <span className={`badge badge-statut-${facture.statut}`}>{LIBELLES_STATUT[facture.statut]}</span>
}
