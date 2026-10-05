import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import {
  CaretLeftIcon,
  ChartLineUpIcon,
  ClockCountdownIcon,
  CoinsIcon,
  PercentIcon,
  ShippingContainerIcon,
  TableIcon,
  WarningCircleIcon
} from '@phosphor-icons/react'
import type { TableauDeBord as Donnees } from '@shared/tableau'
import { formatDate } from '../../../core/facture'
import { formatMontant } from '../../../core/montants'
import { bornesPeriode, libelleMois, type Periode } from '../../../core/periodes'
import { useNotifier } from '../components/ui/Notifications'
import { appel } from '../lib/appel'

interface Props {
  onRetour: () => void
  onOuvrirFacture: (id: number) => void
}

/* Couleurs des séries, validées (contraste, daltonisme) sur fond blanc : HT = bleu roi, TVA = or foncé. */
const SERIE_HT = '#1f56cf'
const SERIE_TVA = '#c48a0c'

const PERIODES: { id: Periode; libelle: string }[] = [
  { id: 'mois', libelle: 'Ce mois' },
  { id: 'trimestre', libelle: 'Ce trimestre' },
  { id: 'annee', libelle: 'Cette année' },
  { id: 'douze-mois', libelle: '12 derniers mois' },
  { id: 'annee-precedente', libelle: 'Année précédente' },
  { id: 'tout', libelle: 'Tout' }
]

/** 1 250 000 → « 1,25 M » ; 85 100 → « 85 k ». */
function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} M`
  if (abs >= 1_000) return `${Math.round(n / 1_000).toLocaleString('fr-FR')} k`
  return String(n)
}

/** Graduations rondes (pas de 1, 2, 2,5 ou 5 × 10ⁿ) couvrant 0 → max. */
function graduations(max: number, cible = 4): number[] {
  if (max <= 0) return [0, 1]
  const brut = max / cible
  const puissance = 10 ** Math.floor(Math.log10(brut))
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? brut
  const ticks: number[] = []
  for (let v = 0; v < max + pas; v += pas) {
    ticks.push(v)
    if (v >= max) break
  }
  return ticks
}

function InfoBulle({ active, payload, label }: TooltipContentProps<ValueType, NameType>): React.JSX.Element | null {
  if (!active || !payload?.length) return null
  const ht = Number(payload.find((p) => p.dataKey === 'ht')?.value ?? 0)
  const tva = Number(payload.find((p) => p.dataKey === 'tva')?.value ?? 0)
  return (
    <div className="infobulle">
      <p className="infobulle-titre">{libelleMois(String(label), true)}</p>
      <p>
        <span className="pastille-serie" style={{ background: SERIE_HT }} />
        HT <strong>{formatMontant(ht)}</strong>
      </p>
      <p>
        <span className="pastille-serie" style={{ background: SERIE_TVA }} />
        TVA <strong>{formatMontant(tva)}</strong>
      </p>
      <p className="infobulle-total">
        TTC <strong>{formatMontant(ht + tva)} FCFA</strong>
      </p>
    </div>
  )
}

function ListeBarres({
  elements,
  unite,
  vide
}: {
  elements: { libelle: string; valeur: number; detail?: string }[]
  unite?: string
  vide: string
}): React.JSX.Element {
  const max = Math.max(1, ...elements.map((e) => e.valeur))
  if (elements.length === 0) return <p className="texte-discret graphique-vide">{vide}</p>
  return (
    <ul className="liste-barres">
      {elements.map((e) => (
        <li key={e.libelle}>
          <div className="liste-barres-ligne">
            <span className="liste-barres-libelle">
              {e.libelle}
              {e.detail && <span>{e.detail}</span>}
            </span>
            <span className="liste-barres-valeur">
              {unite ? formatMontant(e.valeur) : e.valeur}
              {unite && <span> {unite}</span>}
            </span>
          </div>
          <div className="liste-barres-piste">
            <div className="liste-barres-barre" style={{ width: `${(e.valeur / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function TableauDeBord({ onRetour, onOuvrirFacture }: Props): React.JSX.Element {
  const notifier = useNotifier()
  const [periode, setPeriode] = useState<Periode>('annee')
  const [donnees, setDonnees] = useState<Donnees | null>(null)
  const [vueTableau, setVueTableau] = useState(false)

  useEffect(() => {
    appel(window.api.tableauDeBord(bornesPeriode(periode)))
      .then(setDonnees)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [periode, notifier])

  // Les zones au-delà de la 7e sont regroupées en « Autres zones ».
  const zones = useMemo(() => {
    const z = donnees?.conteneursParZone ?? []
    if (z.length <= 8) return z.map((x) => ({ libelle: x.zone, valeur: x.nombre }))
    const autres = z.slice(7).reduce((s, x) => s + x.nombre, 0)
    return [...z.slice(0, 7).map((x) => ({ libelle: x.zone, valeur: x.nombre })), { libelle: 'Autres zones', valeur: autres }]
  }, [donnees])

  const axeY = useMemo(() => graduations(Math.max(0, ...(donnees?.parMois ?? []).map((m) => m.ttc))), [donnees])

  const libellePeriode = PERIODES.find((p) => p.id === periode)?.libelle ?? ''

  return (
    <div className="ecran">
      <header className="ecran-entete">
        <button className="bouton-retour" onClick={onRetour}>
          <CaretLeftIcon size={16} weight="bold" />
          Accueil
        </button>
        <span className="ecran-entete-icone">
          <ChartLineUpIcon size={22} weight="duotone" />
        </span>
        <h1>Tableau de bord</h1>
        <div className="segments entete-filtre" role="group" aria-label="Période">
          {PERIODES.map((p) => (
            <button key={p.id} className={periode === p.id ? 'actif' : ''} onClick={() => setPeriode(p.id)}>
              {p.libelle}
            </button>
          ))}
        </div>
      </header>

      {!donnees ? (
        <p className="chargement">Chargement…</p>
      ) : (
        <div className="tableau-bord">
          <section className="indicateurs">
            <article className="indicateur">
              <span className="indicateur-icone">
                <CoinsIcon size={22} weight="duotone" />
              </span>
              <span className="indicateur-libelle">Chiffre d’affaires HT — ce mois</span>
              <strong className="indicateur-valeur">
                {formatMontant(donnees.mois.ht)} <span>FCFA</span>
              </strong>
              <span className="indicateur-detail">TTC {formatMontant(donnees.mois.ttc)}</span>
            </article>
            <article className="indicateur">
              <span className="indicateur-icone">
                <ChartLineUpIcon size={22} weight="duotone" />
              </span>
              <span className="indicateur-libelle">Chiffre d’affaires HT — {donnees.jour.slice(0, 4)}</span>
              <strong className="indicateur-valeur">
                {formatMontant(donnees.annee.ht)} <span>FCFA</span>
              </strong>
              <span className="indicateur-detail">TTC {formatMontant(donnees.annee.ttc)}</span>
            </article>
            <article className="indicateur">
              <span className="indicateur-icone">
                <PercentIcon size={22} weight="duotone" />
              </span>
              <span className="indicateur-libelle">TVA collectée — {libellePeriode.toLowerCase()}</span>
              <strong className="indicateur-valeur">
                {formatMontant(donnees.periode.tva)} <span>FCFA</span>
              </strong>
              <span className="indicateur-detail">
                {donnees.periode.nb_factures} facture{donnees.periode.nb_factures > 1 ? 's' : ''} · {donnees.periode.nb_conteneurs} conteneur
                {donnees.periode.nb_conteneurs > 1 ? 's' : ''}
              </span>
            </article>
            <article className={`indicateur ${donnees.impayes.montant > 0 ? 'indicateur-alerte' : ''}`}>
              <span className="indicateur-icone">
                <WarningCircleIcon size={22} weight="duotone" />
              </span>
              <span className="indicateur-libelle">Impayés à ce jour</span>
              <strong className="indicateur-valeur">
                {formatMontant(donnees.impayes.montant)} <span>FCFA</span>
              </strong>
              <span className="indicateur-detail">
                {donnees.impayes.nombre === 0
                  ? 'Aucune facture en attente'
                  : `${donnees.impayes.nombre} facture${donnees.impayes.nombre > 1 ? 's' : ''} à encaisser`}
              </span>
            </article>
          </section>

          <section className="carte graphique">
            <header className="graphique-entete">
              <div>
                <h2>Chiffre d’affaires et TVA collectée par mois</h2>
                <p className="texte-discret">
                  Du {formatDate(donnees.du)} au {formatDate(donnees.au)} · factures émises, nettes des avoirs
                </p>
              </div>
              <div className="graphique-outils">
                <ul className="legende">
                  <li>
                    <span className="pastille-serie" style={{ background: SERIE_HT }} />
                    Montant HT
                  </li>
                  <li>
                    <span className="pastille-serie" style={{ background: SERIE_TVA }} />
                    TVA
                  </li>
                </ul>
                <button className={`btn-icone ${vueTableau ? 'actif' : ''}`} title={vueTableau ? 'Voir le graphique' : 'Voir le tableau'} onClick={() => setVueTableau(!vueTableau)}>
                  {vueTableau ? <ChartLineUpIcon size={18} /> : <TableIcon size={18} />}
                </button>
              </div>
            </header>
            {vueTableau ? (
              <div className="graphique-tableau">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th>Mois</th>
                      <th className="col-montant">HT</th>
                      <th className="col-montant">TVA</th>
                      <th className="col-montant">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donnees.parMois.map((m) => (
                      <tr key={m.mois}>
                        <td>{libelleMois(m.mois, true)}</td>
                        <td className="col-montant">{formatMontant(m.ht)}</td>
                        <td className="col-montant">{formatMontant(m.tva)}</td>
                        <td className="col-montant">
                          <strong>{formatMontant(m.ttc)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="graphique-zone">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={donnees.parMois} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke="#eef1f7" />
                    <XAxis
                      dataKey="mois"
                      tickFormatter={(m: string) => libelleMois(m)}
                      tickLine={false}
                      axisLine={{ stroke: '#dde3ef' }}
                      tick={{ fill: '#48557a', fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={8}
                    />
                    <YAxis
                      ticks={axeY}
                      domain={[0, axeY[axeY.length - 1]]}
                      tickFormatter={compact}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#8590aa', fontSize: 12 }}
                      width={56}
                    />
                    <Tooltip content={InfoBulle} cursor={{ fill: 'rgba(31, 86, 207, 0.06)' }} />
                    <Bar dataKey="ht" stackId="ca" fill={SERIE_HT} stroke="#ffffff" strokeWidth={2} maxBarSize={44} />
                    <Bar dataKey="tva" stackId="ca" fill={SERIE_TVA} stroke="#ffffff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <div className="grille-tableau-bord">
            <section className="carte">
              <h3 className="carte-titre">Meilleurs clients</h3>
              <ListeBarres
                elements={donnees.topClients.map((c) => ({
                  libelle: c.client,
                  valeur: c.ht,
                  detail: `${c.nb_factures} facture${c.nb_factures > 1 ? 's' : ''}`
                }))}
                unite="FCFA HT"
                vide="Aucune facture sur la période."
              />
            </section>

            <section className="carte">
              <h3 className="carte-titre">Conteneurs par type</h3>
              <ListeBarres
                elements={donnees.conteneursParType.map((t) => ({ libelle: `Conteneur ${t.libelle}`, valeur: t.nombre }))}
                vide="Aucun conteneur sur la période."
              />
              <h3 className="carte-titre carte-titre-suite">Conteneurs par zone</h3>
              <ListeBarres elements={zones} vide="Aucun conteneur sur la période." />
            </section>

            <section className="carte carte-impayes">
              <h3 className="carte-titre">
                Impayés
                <span className="carte-titre-detail">
                  <ClockCountdownIcon size={15} /> les plus anciens
                </span>
              </h3>
              {donnees.impayes.liste.length === 0 ? (
                <p className="texte-discret graphique-vide">Toutes les factures sont réglées.</p>
              ) : (
                <ul className="liste-impayes">
                  {donnees.impayes.liste.map((i) => (
                    <li key={i.id}>
                      <button onClick={() => onOuvrirFacture(i.id)}>
                        <span className="impaye-principal">
                          <strong>{i.numero}</strong>
                          <span>{i.client}</span>
                        </span>
                        <span className="impaye-montant">
                          <strong>{formatMontant(i.reste)}</strong>
                          <span className={i.jours > 60 ? 'retard' : ''}>
                            {i.jours === 0 ? "aujourd'hui" : `il y a ${i.jours} j`}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {donnees.impayes.nombre > donnees.impayes.liste.length && (
                <p className="texte-discret">
                  et {donnees.impayes.nombre - donnees.impayes.liste.length} autre(s) — voir l’Historique, filtre « À encaisser ».
                </p>
              )}
            </section>
          </div>

          {donnees.periode.nb_conteneurs === 0 && donnees.periode.ht === 0 && (
            <p className="texte-discret tableau-bord-vide">
              <ShippingContainerIcon size={18} /> Les indicateurs se rempliront dès les premières factures validées.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
