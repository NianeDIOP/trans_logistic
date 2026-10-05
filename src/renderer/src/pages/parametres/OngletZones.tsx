import { useCallback, useEffect, useState } from 'react'
import {
  ArrowCounterClockwiseIcon,
  MapTrifoldIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon
} from '@phosphor-icons/react'
import type { ElementListe, Zone } from '@shared/parametres'
import { formatMontant } from '../../../../core/montants'
import Badge from '../../components/ui/Badge'
import { ChampMontant, ChampTexte } from '../../components/ui/Champ'
import EnTeteSection from '../../components/ui/EnTeteSection'
import Modale from '../../components/ui/Modale'
import { useNotifier } from '../../components/ui/Notifications'
import { appel, ErreurApi } from '../../lib/appel'
import { useSuppression } from '../../lib/useSuppression'

interface Edition {
  ancienNom: string | null
  zone: string
  prix: Record<string, number | null>
}

export default function OngletZones(): React.JSX.Element {
  const notifier = useNotifier()
  const [zones, setZones] = useState<Zone[]>([])
  const [types, setTypes] = useState<ElementListe[]>([])
  const [inactifs, setInactifs] = useState(false)
  const [edition, setEdition] = useState<Edition | null>(null)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  const charger = useCallback(() => {
    Promise.all([
      appel(window.api.parametres.zones.lister(inactifs)),
      appel(window.api.parametres.listes.lister('types_conteneurs', true))
    ])
      .then(([z, t]) => {
        setZones(z)
        setTypes(t)
      })
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [inactifs, notifier])

  useEffect(charger, [charger])

  const { demander, dialogue } = useSuppression(charger)

  // Colonnes : types actifs, plus les types désactivés encore présents dans la grille.
  const colonnes = types.filter((t) => t.actif || zones.some((z) => t.code in z.prix))

  const ouvrir = (z: Zone | null): void => {
    setErreurs({})
    const prix: Record<string, number | null> = {}
    for (const t of types) if (t.actif || (z && t.code in z.prix)) prix[t.code] = z?.prix[t.code] ?? null
    setEdition({ ancienNom: z?.zone ?? null, zone: z?.zone ?? '', prix })
  }

  const enregistrer = async (): Promise<void> => {
    if (!edition) return
    try {
      await appel(
        window.api.parametres.zones.enregistrer(edition.ancienNom, { zone: edition.zone, prix: edition.prix })
      )
      notifier(edition.ancienNom === null ? `Zone « ${edition.zone.trim()} » créée.` : 'Tarifs enregistrés.')
      setEdition(null)
      charger()
    } catch (err) {
      if (err instanceof ErreurApi) setErreurs(err.erreurs)
      else notifier((err as Error).message, 'erreur')
    }
  }

  const reactiver = async (z: Zone): Promise<void> => {
    await appel(window.api.parametres.zones.reactiver(z.zone)).catch(() => undefined)
    notifier(`« ${z.zone} » est de nouveau active.`)
    charger()
  }

  const libelleType = (code: string): string => types.find((t) => t.code === code)?.libelle ?? code

  return (
    <div className="onglet">
      <EnTeteSection
        titre="Zones et tarifs"
        description="Prix de transport HT par zone de livraison et par type de conteneur. Ils se remplissent automatiquement sur la facture."
        actions={
          <button className="btn btn-primaire" onClick={() => ouvrir(null)}>
            <PlusIcon size={18} weight="bold" />
            Nouvelle zone
          </button>
        }
      />

      <div className="barre-outils">
        <span className="texte-discret">
          Les types de conteneurs se gèrent dans l'onglet <strong>Listes</strong>.
        </span>
        <label className="interrupteur">
          <input type="checkbox" checked={inactifs} onChange={(e) => setInactifs(e.target.checked)} />
          Afficher les zones désactivées
        </label>
      </div>

      <div className="carte carte-tableau">
        {zones.length === 0 ? (
          <div className="vide">
            <MapTrifoldIcon size={40} weight="duotone" />
            <p>Aucune zone tarifaire.</p>
            <button className="btn btn-secondaire" onClick={() => ouvrir(null)}>
              <PlusIcon size={16} weight="bold" />
              Créer une zone
            </button>
          </div>
        ) : (
          <table className="tableau">
            <thead>
              <tr>
                <th>Zone de livraison</th>
                {colonnes.map((t) => (
                  <th key={t.code} className="col-montant">
                    Conteneur {t.libelle}
                  </th>
                ))}
                <th className="col-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.zone} className={z.actif ? '' : 'ligne-inactive'} onDoubleClick={() => ouvrir(z)}>
                  <td>
                    <strong>{z.zone}</strong>
                  </td>
                  {colonnes.map((t) => (
                    <td key={t.code} className="col-montant">
                      {t.code in z.prix ? (
                        <>
                          {formatMontant(z.prix[t.code])} <span className="unite">FCFA</span>
                        </>
                      ) : (
                        <span className="texte-discret">—</span>
                      )}
                    </td>
                  ))}
                  <td className="col-actions">
                    {!z.actif && <Badge genre="inactif">Désactivée</Badge>}
                    <button className="btn-icone" title="Modifier" onClick={() => ouvrir(z)}>
                      <PencilSimpleIcon size={18} />
                    </button>
                    {z.actif ? (
                      <button
                        className="btn-icone btn-icone-danger"
                        title="Supprimer"
                        onClick={() => demander({ nom: z.zone, action: () => window.api.parametres.zones.supprimer(z.zone) })}
                      >
                        <TrashIcon size={18} />
                      </button>
                    ) : (
                      <button className="btn-icone" title="Réactiver" onClick={() => void reactiver(z)}>
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
          titre={edition.ancienNom === null ? 'Nouvelle zone' : 'Modifier la zone'}
          sousTitre="Laissez un prix vide si ce type de conteneur n'est pas livré dans cette zone."
          onFermer={() => setEdition(null)}
          onValider={() => void enregistrer()}
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
          <div className="grille-champs">
            <ChampTexte
              className="pleine-largeur"
              libelle="Zone de livraison"
              obligatoire
              placeholder="ex. Dakar Zone 1"
              valeur={edition.zone}
              onChange={(v) => setEdition({ ...edition, zone: v })}
              erreur={erreurs.zone}
            />
            {Object.keys(edition.prix).map((code) => (
              <ChampMontant
                key={code}
                libelle={`Prix HT — conteneur ${libelleType(code)}`}
                valeur={edition.prix[code]}
                onChange={(v) => setEdition({ ...edition, prix: { ...edition.prix, [code]: v } })}
              />
            ))}
            {erreurs.prix && <p className="champ-message pleine-largeur">{erreurs.prix}</p>}
          </div>
        </Modale>
      )}
      {dialogue}
    </div>
  )
}
