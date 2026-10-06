import { useCallback, useEffect, useState } from 'react'
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CopyIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  FilePlusIcon,
  MoneyIcon,
  PrinterIcon,
  ReceiptXIcon,
  TrashIcon
} from '@phosphor-icons/react'
import type { Facture } from '@shared/factures'
import type { Paiement } from '@shared/historique'
import { formatDate } from '../../../../core/facture'
import { formatMontant } from '../../../../core/montants'
import Confirmation from '../../components/ui/Confirmation'
import { useNotifier } from '../../components/ui/Notifications'
import { appel } from '../../lib/appel'
import ApercuDocument from './ApercuDocument'
import ModaleAvoir from './ModaleAvoir'
import ModalePaiement from './ModalePaiement'
import ModaleSuppressionFacture from './ModaleSuppressionFacture'

interface Props {
  facture: Facture
  /** Vient d'être validée (message de confirmation). */
  nouvelle?: boolean
  onNouvelleFacture: () => void
  /** La facture a changé (règlement, annulation). */
  onChange: (facture: Facture) => void
  onOuvrir: (route: { factureId?: number; dupliquerDe?: number }) => void
  /** Après suppression définitive. */
  onSupprimee: () => void
}

/** Facture émise : lecture seule, PDF, règlements, avoir, duplication. */
export default function VueFacture({ facture, nouvelle, onNouvelleFacture, onChange, onOuvrir, onSupprimee }: Props): React.JSX.Element {
  const notifier = useNotifier()
  const [html, setHtml] = useState<string | null>(null)
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [enCours, setEnCours] = useState<string | null>(null)
  const [modale, setModale] = useState<'paiement' | 'avoir' | 'suppression' | null>(null)
  const [aSupprimer, setASupprimer] = useState<Paiement | null>(null)
  const estAvoir = facture.type === 'avoir'
  const reste = facture.total_ttc - facture.regle
  const encaissable = !estAvoir && (facture.statut === 'emise' || facture.statut === 'partiellement_payee')

  const chargerPaiements = useCallback(() => {
    if (estAvoir) return
    appel(window.api.factures.paiements(facture.id))
      .then(setPaiements)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [facture.id, estAvoir, notifier])

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
    chargerPaiements()
  }, [facture, notifier, chargerPaiements])

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

  const supprimerPaiement = async (): Promise<void> => {
    if (!aSupprimer) return
    const p = aSupprimer
    setASupprimer(null)
    await action('suppression', async () => {
      onChange(await appel(window.api.factures.supprimerPaiement(p.id)))
      notifier('Règlement supprimé.')
    })
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
          <span className="surtitre">{estAvoir ? 'Avoir' : 'Facture'}</span>
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
              <dt>{estAvoir ? 'Montant' : 'Total TTC'}</dt>
              <dd className="vue-facture-montant">{formatMontant(facture.total_ttc)} FCFA</dd>
            </div>
            {!estAvoir && (
              <>
                <div>
                  <dt>Réglé</dt>
                  <dd>{formatMontant(facture.regle)}</dd>
                </div>
                {facture.statut !== 'annulee' && (
                  <div className={reste > 0 ? 'reste-du' : 'reste-solde'}>
                    <dt>Reste à payer</dt>
                    <dd>{reste > 0 ? `${formatMontant(reste)} FCFA` : 'Soldée'}</dd>
                  </div>
                )}
              </>
            )}
          </dl>

          {estAvoir && facture.origine && (
            <button className="lien-document" onClick={() => onOuvrir({ factureId: facture.origine!.id })}>
              <ArrowSquareOutIcon size={16} />
              Annule la facture {facture.origine.numero}
            </button>
          )}
          {facture.avoir && (
            <button className="lien-document lien-annulee" onClick={() => onOuvrir({ factureId: facture.avoir!.id })}>
              <ArrowSquareOutIcon size={16} />
              Annulée par l’avoir {facture.avoir.numero}
            </button>
          )}
        </div>

        <div className="vue-facture-actions">
          {encaissable && (
            <button className="btn btn-primaire" onClick={() => setModale('paiement')}>
              <MoneyIcon size={18} weight="duotone" />
              Enregistrer un règlement
            </button>
          )}
          <button
            className={`btn ${encaissable ? 'btn-secondaire' : 'btn-primaire'}`}
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
          {!estAvoir && (
            <button className="btn btn-secondaire" onClick={() => onOuvrir({ dupliquerDe: facture.id })}>
              <CopyIcon size={18} weight="duotone" />
              Dupliquer
            </button>
          )}
          {!estAvoir && facture.statut !== 'annulee' && (
            <button className="btn btn-fantome btn-avoir" onClick={() => setModale('avoir')}>
              <ReceiptXIcon size={18} weight="duotone" />
              Annuler par un avoir…
            </button>
          )}
          <button className="btn btn-fantome btn-avoir" onClick={() => setModale('suppression')}>
            <TrashIcon size={18} weight="duotone" />
            Supprimer définitivement…
          </button>
          <button className="btn btn-fantome btn-nouvelle" onClick={onNouvelleFacture}>
            <FilePlusIcon size={18} weight="duotone" />
            Nouvelle facture
          </button>
        </div>

        {!estAvoir && paiements.length > 0 && (
          <div className="carte">
            <h3 className="carte-titre">Règlements</h3>
            <ul className="liste-paiements">
              {paiements.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{formatMontant(p.montant)} FCFA</strong>
                    <span>
                      {formatDate(p.date)} · {p.mode_libelle}
                      {p.reference && ` · ${p.reference}`}
                    </span>
                  </div>
                  {facture.statut !== 'annulee' && (
                    <button className="btn-icone btn-icone-danger" title="Supprimer ce règlement" onClick={() => setASupprimer(p)}>
                      <TrashIcon size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!nouvelle && (
          <p className="texte-discret">
            {estAvoir
              ? 'Un avoir est définitif.'
              : 'Une facture émise ne peut plus être modifiée. Pour l’annuler, émettez un avoir.'}
          </p>
        )}
      </aside>

      {modale === 'paiement' && (
        <ModalePaiement
          facture={facture}
          onFermer={() => setModale(null)}
          onEnregistre={(f) => {
            setModale(null)
            onChange(f)
          }}
        />
      )}
      {modale === 'avoir' && (
        <ModaleAvoir
          facture={facture}
          onFermer={() => setModale(null)}
          onCree={(avoir) => {
            setModale(null)
            onOuvrir({ factureId: avoir.id })
          }}
        />
      )}
      {modale === 'suppression' && (
        <ModaleSuppressionFacture
          facture={{ id: facture.id, numero: facture.numero, type: facture.type, client: facture.client_raison_sociale }}
          onFermer={() => setModale(null)}
          onSupprimee={() => {
            setModale(null)
            onSupprimee()
          }}
        />
      )}
      {aSupprimer && (
        <Confirmation
          titre="Supprimer ce règlement ?"
          danger
          libelleAction="Supprimer"
          message={
            <p>
              Le règlement de <strong>{formatMontant(aSupprimer.montant)} FCFA</strong> du {formatDate(aSupprimer.date)} sera
              supprimé et le statut de la facture recalculé.
            </p>
          }
          onConfirmer={() => void supprimerPaiement()}
          onAnnuler={() => setASupprimer(null)}
        />
      )}
    </div>
  )
}
