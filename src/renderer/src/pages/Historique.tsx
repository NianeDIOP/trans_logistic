import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CaretLeftIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  FilePdfIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  XIcon
} from '@phosphor-icons/react'
import type { FiltresHistorique, PageHistorique } from '@shared/historique'
import { formatDate } from '../../../core/facture'
import { bornesPeriode, type Periode } from '../../../core/periodes'
import { formatMontant } from '../../../core/montants'
import BadgeStatut from '../components/BadgeStatut'
import MenuExport from '../components/MenuExport'
import { useNotifier } from '../components/ui/Notifications'
import { appel } from '../lib/appel'
import ModaleSuppressionFacture from './facture/ModaleSuppressionFacture'
import type { ResumeFacture } from '@shared/historique'

interface Props {
  onRetour: () => void
  onOuvrir: (factureId: number) => void
  onDupliquer: (factureId: number) => void
}

const PERIODES: { id: Periode; libelle: string }[] = [
  { id: 'tout', libelle: 'Tout' },
  { id: 'mois', libelle: 'Ce mois' },
  { id: 'mois-precedent', libelle: 'Mois précédent' },
  { id: 'annee', libelle: 'Cette année' },
  { id: 'perso', libelle: 'Période…' }
]

const STATUTS: { valeur: FiltresHistorique['statut'] | ''; libelle: string }[] = [
  { valeur: '', libelle: 'Tous les statuts' },
  { valeur: 'impayee', libelle: 'À encaisser' },
  { valeur: 'brouillon', libelle: 'Brouillons' },
  { valeur: 'emise', libelle: 'Émises' },
  { valeur: 'partiellement_payee', libelle: 'Partiellement payées' },
  { valeur: 'payee', libelle: 'Payées' },
  { valeur: 'annulee', libelle: 'Annulées' },
  { valeur: 'avoir', libelle: 'Avoirs' }
]

const PAR_PAGE = 25

export default function Historique({ onRetour, onOuvrir, onDupliquer }: Props): React.JSX.Element {
  const notifier = useNotifier()
  const [recherche, setRecherche] = useState('')
  const [rechercheEffective, setRechercheEffective] = useState('')
  const [periode, setPeriode] = useState<Periode>('tout')
  const [du, setDu] = useState('')
  const [au, setAu] = useState('')
  const [statut, setStatut] = useState<FiltresHistorique['statut'] | ''>('')
  const [page, setPage] = useState(1)
  const [resultat, setResultat] = useState<PageHistorique | null>(null)
  const [aSupprimer, setASupprimer] = useState<ResumeFacture | null>(null)
  const champRecherche = useRef<HTMLInputElement>(null)

  // Recherche appliquée après une courte pause de frappe.
  useEffect(() => {
    const t = setTimeout(() => {
      setRechercheEffective(recherche)
      setPage(1)
    }, 250)
    return () => clearTimeout(t)
  }, [recherche])

  const filtres = useCallback((): FiltresHistorique => {
    const b = periode === 'perso' ? { du: du || undefined, au: au || undefined } : bornesPeriode(periode)
    return { recherche: rechercheEffective, ...b, statut: statut || undefined }
  }, [rechercheEffective, periode, du, au, statut])

  const charger = useCallback(() => {
    appel(window.api.factures.lister({ ...filtres(), page, parPage: PAR_PAGE }))
      .then(setResultat)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [filtres, page, notifier])

  useEffect(charger, [charger])
  useEffect(() => champRecherche.current?.focus(), [])

  const changerFiltre = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setPage(1)
  }

  const pages = resultat ? Math.max(1, Math.ceil(resultat.total / resultat.parPage)) : 1
  const debut = resultat && resultat.total > 0 ? (resultat.page - 1) * resultat.parPage + 1 : 0
  const fin = resultat ? Math.min(resultat.page * resultat.parPage, resultat.total) : 0
  const filtreActif = Boolean(rechercheEffective || periode !== 'tout' || statut)

  return (
    <div className="ecran">
      <header className="ecran-entete">
        <button className="bouton-retour" onClick={onRetour}>
          <CaretLeftIcon size={16} weight="bold" />
          Accueil
        </button>
        <span className="ecran-entete-icone">
          <ClockCounterClockwiseIcon size={22} weight="duotone" />
        </span>
        <h1>Historique</h1>
        <div className="entete-actions">
          <MenuExport
            choix={[
              { genre: 'factures', libelle: 'Liste des factures', detail: 'Une ligne par facture ou avoir, avec règlements et reste à payer' },
              { genre: 'lignes', libelle: 'Détail des lignes', detail: 'Une ligne par conteneur, AGS, imprimé…' }
            ]}
            exporter={(genre) => window.api.exports.historique(filtres(), genre)}
          />
        </div>
      </header>

      <div className="historique">
        <section className="filtres">
          <label className="recherche recherche-large">
            <MagnifyingGlassIcon size={18} />
            <input
              ref={champRecherche}
              placeholder="N° de facture, client, N° BL ou N° de conteneur"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            {recherche && (
              <button className="btn-icone" aria-label="Effacer" onClick={() => setRecherche('')}>
                <XIcon size={14} />
              </button>
            )}
          </label>
          <select className="saisie filtre-statut" value={statut} onChange={(e) => changerFiltre(setStatut)(e.target.value as typeof statut)} aria-label="Statut">
            {STATUTS.map((s) => (
              <option key={s.libelle} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </select>
        </section>

        <section className="filtres-periode">
          <div className="segments" role="group" aria-label="Période">
            {PERIODES.map((p) => (
              <button key={p.id} className={periode === p.id ? 'actif' : ''} onClick={() => changerFiltre(setPeriode)(p.id)}>
                {p.libelle}
              </button>
            ))}
          </div>
          {periode === 'perso' && (
            <div className="periode-perso">
              <input type="date" className="saisie" value={du} onChange={(e) => changerFiltre(setDu)(e.target.value)} aria-label="Du" />
              <span>au</span>
              <input type="date" className="saisie" value={au} onChange={(e) => changerFiltre(setAu)(e.target.value)} aria-label="Au" />
            </div>
          )}
          {resultat && (
            <div className="historique-totaux">
              <span>
                <strong>{resultat.total}</strong> document{resultat.total > 1 ? 's' : ''}
              </span>
              <span>
                Facturé <strong>{formatMontant(resultat.montant_ttc)}</strong>
              </span>
              <span className={resultat.reste_a_encaisser > 0 ? 'a-encaisser' : ''}>
                À encaisser <strong>{formatMontant(resultat.reste_a_encaisser)}</strong> FCFA
              </span>
            </div>
          )}
        </section>

        <section className="carte carte-tableau">
          {resultat && resultat.lignes.length === 0 ? (
            <div className="vide">
              <ClockCounterClockwiseIcon size={40} weight="duotone" />
              <p>{filtreActif ? 'Aucune facture ne correspond à ces critères.' : 'Aucune facture pour le moment.'}</p>
            </div>
          ) : (
            <table className="tableau tableau-historique">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>N° BL</th>
                  <th className="col-montant">Montant TTC</th>
                  <th className="col-montant">Reste à payer</th>
                  <th>Statut</th>
                  <th className="col-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {resultat?.lignes.map((f) => {
                  const reste = f.type === 'facture' && (f.statut === 'emise' || f.statut === 'partiellement_payee') ? f.total_ttc - f.regle : 0
                  return (
                    <tr key={f.id} className="ligne-cliquable" onClick={() => onOuvrir(f.id)}>
                      <td>
                        <strong className={f.numero ? 'numero' : 'numero numero-vide'}>{f.numero ?? 'Brouillon'}</strong>
                        {f.lie_numero && (
                          <span className="sous-ligne">{f.type === 'avoir' ? `annule ${f.lie_numero}` : `annulée par ${f.lie_numero}`}</span>
                        )}
                      </td>
                      <td>{formatDate(f.date)}</td>
                      <td>
                        <strong>{f.client_raison_sociale || '—'}</strong>
                        {f.nb_conteneurs > 0 && (
                          <span className="sous-ligne">
                            {f.nb_conteneurs} conteneur{f.nb_conteneurs > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td>{f.num_bl || '—'}</td>
                      <td className={`col-montant ${f.type === 'avoir' ? 'montant-avoir' : ''}`}>
                        {f.type === 'avoir' ? '−' : ''}
                        {formatMontant(f.total_ttc)}
                      </td>
                      <td className="col-montant">{reste > 0 ? <strong className="reste">{formatMontant(reste)}</strong> : <span className="texte-discret">—</span>}</td>
                      <td>
                        <BadgeStatut facture={f} />
                      </td>
                      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                        {f.numero && (
                          <button
                            className="btn-icone"
                            title="Ouvrir le PDF"
                            onClick={() =>
                              void appel(window.api.factures.ouvrirPdf(f.id)).catch((err: Error) => notifier(err.message, 'erreur'))
                            }
                          >
                            <FilePdfIcon size={18} />
                          </button>
                        )}
                        {f.type === 'facture' && (
                          <button className="btn-icone" title="Dupliquer" onClick={() => onDupliquer(f.id)}>
                            <CopyIcon size={18} />
                          </button>
                        )}
                        {f.numero && (
                          <button className="btn-icone btn-icone-danger" title="Supprimer définitivement" onClick={() => setASupprimer(f)}>
                            <TrashIcon size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>

        {resultat && resultat.total > PAR_PAGE && (
          <nav className="pagination" aria-label="Pagination">
            <span>
              {debut}–{fin} sur {resultat.total}
            </span>
            <button className="btn-icone" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Page précédente">
              <CaretLeftIcon size={18} />
            </button>
            <span className="pagination-page">
              Page {resultat.page} / {pages}
            </span>
            <button className="btn-icone" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Page suivante">
              <CaretRightIcon size={18} />
            </button>
          </nav>
        )}
      </div>

      {aSupprimer && (
        <ModaleSuppressionFacture
          facture={{ id: aSupprimer.id, numero: aSupprimer.numero, type: aSupprimer.type, client: aSupprimer.client_raison_sociale }}
          onFermer={() => setASupprimer(null)}
          onSupprimee={() => {
            setASupprimer(null)
            charger()
          }}
        />
      )}
    </div>
  )
}
