import { useEffect, useState } from 'react'
import {
  CheckCircleIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  FilePlusIcon,
  PrinterIcon
} from '@phosphor-icons/react'
import type { Facture } from '@shared/factures'
import { formatDate } from '../../../../core/facture'
import { formatMontant } from '../../../../core/montants'
import { useNotifier } from '../../components/ui/Notifications'
import { appel } from '../../lib/appel'
import ApercuDocument from './ApercuDocument'

interface Props {
  facture: Facture
  /** Vient d'être validée (message de confirmation). */
  nouvelle?: boolean
  onNouvelleFacture: () => void
}

/** Facture validée : lecture seule, PDF, copie, impression. */
export default function VueFacture({ facture, nouvelle, onNouvelleFacture }: Props): React.JSX.Element {
  const notifier = useNotifier()
  const [html, setHtml] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<string | null>(null)

  useEffect(() => {
    const saisie = {
      id: facture.id,
      client_id: facture.client_id,
      date: facture.date,
      num_bl: facture.num_bl,
      notes: facture.notes,
      lignes: facture.lignes
    }
    appel(window.api.factures.apercu(saisie))
      .then(setHtml)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [facture, notifier])

  const action = async (nom: string, fn: () => Promise<unknown>): Promise<void> => {
    setEnCours(nom)
    try {
      await fn()
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    } finally {
      setEnCours(null)
    }
  }

  return (
    <div className="vue-facture">
      <div className="vue-facture-apercu">{html && <ApercuDocument html={html} />}</div>

      <aside className="vue-facture-panneau">
        {nouvelle && (
          <div className="bandeau-succes">
            <CheckCircleIcon size={22} weight="fill" />
            <div>
              <strong>Facture validée</strong>
              <span>Numéro attribué et PDF archivé.</span>
            </div>
          </div>
        )}

        <div className="carte">
          <span className="surtitre">Facture</span>
          <p className="vue-facture-numero">{facture.numero}</p>
          <dl className="vue-facture-infos">
            <div>
              <dt>Client</dt>
              <dd>{facture.client_raison_sociale}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(facture.date)}</dd>
            </div>
            {facture.num_bl && (
              <div>
                <dt>N° BL</dt>
                <dd>{facture.num_bl}</dd>
              </div>
            )}
            <div>
              <dt>Net à payer</dt>
              <dd className="vue-facture-montant">{formatMontant(facture.total_ttc)} FCFA</dd>
            </div>
          </dl>
        </div>

        <div className="vue-facture-actions">
          <button
            className="btn btn-primaire"
            disabled={enCours !== null}
            onClick={() => void action('pdf', () => appel(window.api.factures.ouvrirPdf(facture.id)))}
          >
            <FilePdfIcon size={18} weight="duotone" />
            Ouvrir le PDF
          </button>
          <button
            className="btn btn-secondaire"
            disabled={enCours !== null}
            onClick={() => void action('imprimer', () => appel(window.api.factures.imprimer(facture.id)))}
          >
            <PrinterIcon size={18} weight="duotone" />
            Imprimer
          </button>
          <button
            className="btn btn-secondaire"
            disabled={enCours !== null}
            onClick={() =>
              void action('copie', async () => {
                const chemin = await appel(window.api.factures.enregistrerCopie(facture.id))
                if (chemin) notifier('Copie du PDF enregistrée.')
              })
            }
          >
            <DownloadSimpleIcon size={18} weight="duotone" />
            Enregistrer une copie…
          </button>
          <button className="btn btn-fantome btn-nouvelle" onClick={onNouvelleFacture}>
            <FilePlusIcon size={18} weight="duotone" />
            Nouvelle facture
          </button>
        </div>

        <p className="texte-discret">
          Une facture validée ne peut plus être modifiée. Pour l’annuler, il faudra émettre un avoir
          (module Historique).
        </p>
      </aside>
    </div>
  )
}
