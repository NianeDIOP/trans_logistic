import type { Totaux as TotauxFacture } from '../../../../core/tva'
import { montantEnLettres } from '../../../../core/lettres'
import { formatMontant } from '../../../../core/montants'

interface Props {
  totaux: TotauxFacture
  taux: number
}

export default function Totaux({ totaux, taux }: Props): React.JSX.Element {
  let lettres = ''
  try {
    lettres = montantEnLettres(totaux.total_ttc)
  } catch {
    lettres = 'Montant trop élevé pour être écrit en lettres.'
  }
  return (
    <div className="totaux-bloc">
      <div className="totaux-lettres">
        <span className="surtitre">Arrêtée à la somme de</span>
        <p>{lettres}</p>
      </div>
      <dl className="totaux-liste">
        <div>
          <dt>Transport HT (conteneurs)</dt>
          <dd>{formatMontant(totaux.base_tva)}</dd>
        </div>
        <div>
          <dt>TVA {taux} % sur conteneurs</dt>
          <dd>{formatMontant(totaux.total_tva)}</dd>
        </div>
        <div>
          <dt>Débours hors TVA (AGS, imprimé…)</dt>
          <dd>{formatMontant(totaux.total_ht - totaux.base_tva)}</dd>
        </div>
        <div className="totaux-secondaire">
          <dt>Total HT</dt>
          <dd>{formatMontant(totaux.total_ht)}</dd>
        </div>
        <div className="totaux-net">
          <dt>Net à payer</dt>
          <dd>
            {formatMontant(totaux.total_ttc)} <span>FCFA</span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
