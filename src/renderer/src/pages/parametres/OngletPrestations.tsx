import { useCallback, useEffect, useState } from 'react'
import {
  ArrowCounterClockwiseIcon,
  PencilSimpleIcon,
  PlusIcon,
  ReceiptIcon,
  TrashIcon
} from '@phosphor-icons/react'
import type { Prestation, PrestationSaisie } from '@shared/parametres'
import { formatMontant } from '../../../../core/montants'
import Badge from '../../components/ui/Badge'
import { ChampMontant, ChampTexte } from '../../components/ui/Champ'
import EnTeteSection from '../../components/ui/EnTeteSection'
import Modale from '../../components/ui/Modale'
import { useNotifier } from '../../components/ui/Notifications'
import { appel, ErreurApi } from '../../lib/appel'
import { useSuppression } from '../../lib/useSuppression'

interface Edition {
  id: number | null
  libelle: string
  prix: number | null
  soumis_tva: boolean
  par_conteneur: boolean
  automatique: boolean
}

export default function OngletPrestations(): React.JSX.Element {
  const notifier = useNotifier()
  const [prestations, setPrestations] = useState<Prestation[]>([])
  const [inactifs, setInactifs] = useState(false)
  const [edition, setEdition] = useState<Edition | null>(null)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  const charger = useCallback(() => {
    appel(window.api.parametres.prestations.lister(inactifs))
      .then(setPrestations)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [inactifs, notifier])

  useEffect(charger, [charger])

  const { demander, dialogue } = useSuppression(charger)

  const ouvrir = (p: Prestation | null): void => {
    setErreurs({})
    setEdition(
      p
        ? { id: p.id, libelle: p.libelle, prix: p.prix, soumis_tva: p.soumis_tva, par_conteneur: p.par_conteneur, automatique: p.automatique }
        : { id: null, libelle: '', prix: null, soumis_tva: false, par_conteneur: false, automatique: false }
    )
  }

  const enregistrer = async (): Promise<void> => {
    if (!edition) return
    const saisie: PrestationSaisie = {
      libelle: edition.libelle,
      prix: edition.prix ?? Number.NaN,
      soumis_tva: edition.soumis_tva,
      par_conteneur: edition.par_conteneur,
      automatique: edition.automatique
    }
    try {
      const api = window.api.parametres.prestations
      await appel(edition.id === null ? api.creer(saisie) : api.modifier(edition.id, saisie))
      notifier(edition.id === null ? `« ${saisie.libelle.trim()} » ajouté.` : 'Prestation modifiée.')
      setEdition(null)
      charger()
    } catch (err) {
      if (err instanceof ErreurApi) setErreurs(err.erreurs)
      else notifier((err as Error).message, 'erreur')
    }
  }

  const reactiver = async (p: Prestation): Promise<void> => {
    await appel(window.api.parametres.prestations.reactiver(p.id)).catch(() => undefined)
    notifier(`« ${p.libelle} » est de nouveau actif.`)
    charger()
  }

  return (
    <div className="onglet">
      <EnTeteSection
        titre="Prestations et débours"
        description="Frais ajoutés en un clic sur une facture, avec leur prix et leur régime de TVA. Les débours (AGS, imprimé…) sont hors TVA."
        actions={
          <button className="btn btn-primaire" onClick={() => ouvrir(null)}>
            <PlusIcon size={18} weight="bold" />
            Nouvelle prestation
          </button>
        }
      />

      <div className="barre-outils">
        <span />
        <label className="interrupteur">
          <input type="checkbox" checked={inactifs} onChange={(e) => setInactifs(e.target.checked)} />
          Afficher les prestations désactivées
        </label>
      </div>

      <div className="carte carte-tableau">
        {prestations.length === 0 ? (
          <div className="vide">
            <ReceiptIcon size={40} weight="duotone" />
            <p>Aucune prestation.</p>
          </div>
        ) : (
          <table className="tableau">
            <thead>
              <tr>
                <th>Libellé</th>
                <th className="col-montant">Prix HT</th>
                <th>Facturation</th>
                <th>TVA</th>
                <th className="col-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {prestations.map((p) => (
                <tr key={p.id} className={p.actif ? '' : 'ligne-inactive'} onDoubleClick={() => ouvrir(p)}>
                  <td>
                    <strong>{p.libelle}</strong>
                  </td>
                  <td className="col-montant">
                    {formatMontant(p.prix)} <span className="unite">FCFA{p.par_conteneur ? ' / TC' : ''}</span>
                  </td>
                  <td>
                    {p.par_conteneur ? 'Par conteneur' : 'Par facture'}
                    {p.automatique && <span className="sous-ligne">Ajoutée d’office</span>}
                  </td>
                  <td>
                    {p.soumis_tva ? <Badge genre="tva">Soumis à TVA</Badge> : <Badge genre="hors-tva">Hors TVA</Badge>}
                  </td>
                  <td className="col-actions">
                    {!p.actif && <Badge genre="inactif">Désactivée</Badge>}
                    <button className="btn-icone" title="Modifier" onClick={() => ouvrir(p)}>
                      <PencilSimpleIcon size={18} />
                    </button>
                    {p.actif ? (
                      <button
                        className="btn-icone btn-icone-danger"
                        title="Supprimer"
                        onClick={() => demander({ nom: p.libelle, action: () => window.api.parametres.prestations.supprimer(p.id) })}
                      >
                        <TrashIcon size={18} />
                      </button>
                    ) : (
                      <button className="btn-icone" title="Réactiver" onClick={() => void reactiver(p)}>
                        <ArrowCounterClockwiseIcon size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edition && (
        <Modale
          titre={edition.id === null ? 'Nouvelle prestation' : 'Modifier la prestation'}
          onFermer={() => setEdition(null)}
          onValider={() => void enregistrer()}
          largeur={480}
          pied={
            <>
              <button type="button" className="btn btn-secondaire" onClick={() => setEdition(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primaire">
                Enregistrer
              </button>
            </>
          }
        >
          <div className="grille-champs grille-une-colonne">
            <ChampTexte libelle="Libellé" obligatoire placeholder="ex. AGS aller simple" valeur={edition.libelle} onChange={(v) => setEdition({ ...edition, libelle: v })} erreur={erreurs.libelle} />
            <ChampMontant libelle={edition.par_conteneur ? 'Prix HT par conteneur' : 'Prix HT'} obligatoire valeur={edition.prix} onChange={(v) => setEdition({ ...edition, prix: v })} erreur={erreurs.prix} />
            <div className="choix-tva" role="radiogroup" aria-label="Régime de TVA">
              <button type="button" role="radio" aria-checked={!edition.soumis_tva} className={!edition.soumis_tva ? 'actif' : ''} onClick={() => setEdition({ ...edition, soumis_tva: false })}>
                <strong>Hors TVA</strong>
                <span>Débours refacturé à l'identique</span>
              </button>
              <button type="button" role="radio" aria-checked={edition.soumis_tva} className={edition.soumis_tva ? 'actif' : ''} onClick={() => setEdition({ ...edition, soumis_tva: true })}>
                <strong>Soumis à TVA</strong>
                <span>Prestation facturée par 2M</span>
              </button>
            </div>
            <label className="option">
              <input type="checkbox" className="case" checked={edition.par_conteneur} onChange={(e) => setEdition({ ...edition, par_conteneur: e.target.checked })} />
              <span>
                <strong>Facturée par conteneur</strong>
                Le montant est multiplié par le nombre de conteneurs de la facture (ex. AGS : 1 500 × 3 TC = 4 500).
              </span>
            </label>
            <label className="option">
              <input type="checkbox" className="case" checked={edition.automatique} onChange={(e) => setEdition({ ...edition, automatique: e.target.checked })} />
              <span>
                <strong>Ajoutée d’office à chaque nouvelle facture</strong>
                Elle peut toujours être retirée d’une facture particulière.
              </span>
            </label>
          </div>
        </Modale>
      )}
      {dialogue}
    </div>
  )
}
