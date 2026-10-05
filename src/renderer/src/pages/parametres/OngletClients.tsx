import { useCallback, useEffect, useState } from 'react'
import {
  ArrowCounterClockwiseIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  TrashIcon,
  UsersThreeIcon
} from '@phosphor-icons/react'
import type { Client, ClientSaisie } from '@shared/parametres'
import Badge from '../../components/ui/Badge'
import { ChampTexte } from '../../components/ui/Champ'
import EnTeteSection from '../../components/ui/EnTeteSection'
import Modale from '../../components/ui/Modale'
import { useNotifier } from '../../components/ui/Notifications'
import { appel, ErreurApi } from '../../lib/appel'
import { useSuppression } from '../../lib/useSuppression'

const VIDE: ClientSaisie = { raison_sociale: '', adresse: '', ninea: '', tel: '', email: '' }

export default function OngletClients(): React.JSX.Element {
  const notifier = useNotifier()
  const [clients, setClients] = useState<Client[]>([])
  const [recherche, setRecherche] = useState('')
  const [inactifs, setInactifs] = useState(false)
  const [edition, setEdition] = useState<{ id: number | null; saisie: ClientSaisie } | null>(null)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  const charger = useCallback(() => {
    appel(window.api.parametres.clients.lister({ recherche, inclureInactifs: inactifs }))
      .then(setClients)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [recherche, inactifs, notifier])

  useEffect(charger, [charger])

  const { demander, dialogue } = useSuppression(charger)

  const ouvrir = (c: Client | null): void => {
    setErreurs({})
    setEdition({ id: c?.id ?? null, saisie: c ? { ...c } : { ...VIDE } })
  }

  const enregistrer = async (): Promise<void> => {
    if (!edition) return
    try {
      const api = window.api.parametres.clients
      const c = await appel(
        edition.id === null ? api.creer(edition.saisie) : api.modifier(edition.id, edition.saisie)
      )
      notifier(edition.id === null ? `Client « ${c.raison_sociale} » créé.` : 'Client modifié.')
      setEdition(null)
      charger()
    } catch (err) {
      if (err instanceof ErreurApi) setErreurs(err.erreurs)
      else notifier((err as Error).message, 'erreur')
    }
  }

  const reactiver = async (c: Client): Promise<void> => {
    await appel(window.api.parametres.clients.reactiver(c.id)).catch(() => undefined)
    notifier(`« ${c.raison_sociale} » est de nouveau actif.`)
    charger()
  }

  const maj = (champ: keyof ClientSaisie) => (v: string) =>
    edition && setEdition({ ...edition, saisie: { ...edition.saisie, [champ]: v } })

  return (
    <div className="onglet">
      <EnTeteSection
        titre="Clients"
        description="Les clients proposés à la saisie d'une facture. Leur bloc d'adresse est repris sur le PDF."
        actions={
          <button className="btn btn-primaire" onClick={() => ouvrir(null)}>
            <PlusIcon size={18} weight="bold" />
            Nouveau client
          </button>
        }
      />

      <div className="barre-outils">
        <label className="recherche">
          <MagnifyingGlassIcon size={18} />
          <input
            placeholder="Rechercher par nom, NINEA, téléphone ou email"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </label>
        <label className="interrupteur">
          <input type="checkbox" checked={inactifs} onChange={(e) => setInactifs(e.target.checked)} />
          Afficher les clients désactivés
        </label>
      </div>

      <div className="carte carte-tableau">
        {clients.length === 0 ? (
          <div className="vide">
            <UsersThreeIcon size={40} weight="duotone" />
            <p>{recherche ? 'Aucun client ne correspond à la recherche.' : 'Aucun client pour le moment.'}</p>
            {!recherche && (
              <button className="btn btn-secondaire" onClick={() => ouvrir(null)}>
                <PlusIcon size={16} weight="bold" />
                Ajouter le premier client
              </button>
            )}
          </div>
        ) : (
          <table className="tableau">
            <thead>
              <tr>
                <th>Raison sociale</th>
                <th>NINEA</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th className="col-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className={c.actif ? '' : 'ligne-inactive'} onDoubleClick={() => ouvrir(c)}>
                  <td>
                    <strong>{c.raison_sociale}</strong>
                    {c.adresse && <span className="sous-ligne">{c.adresse}</span>}
                  </td>
                  <td>{c.ninea || '—'}</td>
                  <td>{c.tel || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td className="col-actions">
                    {!c.actif && <Badge genre="inactif">Désactivé</Badge>}
                    <button className="btn-icone" title="Modifier" onClick={() => ouvrir(c)}>
                      <PencilSimpleIcon size={18} />
                    </button>
                    {c.actif ? (
                      <button
                        className="btn-icone btn-icone-danger"
                        title="Supprimer"
                        onClick={() =>
                          demander({ nom: c.raison_sociale, action: () => window.api.parametres.clients.supprimer(c.id) })
                        }
                      >
                        <TrashIcon size={18} />
                      </button>
                    ) : (
                      <button className="btn-icone" title="Réactiver" onClick={() => void reactiver(c)}>
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
          titre={edition.id === null ? 'Nouveau client' : 'Modifier le client'}
          onFermer={() => setEdition(null)}
          onValider={() => void enregistrer()}
          largeur={600}
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
            <ChampTexte className="pleine-largeur" libelle="Raison sociale" obligatoire valeur={edition.saisie.raison_sociale} onChange={maj('raison_sociale')} erreur={erreurs.raison_sociale} />
            <ChampTexte className="pleine-largeur" libelle="Adresse" valeur={edition.saisie.adresse} onChange={maj('adresse')} />
            <ChampTexte libelle="NINEA" valeur={edition.saisie.ninea} onChange={maj('ninea')} />
            <ChampTexte libelle="Téléphone" valeur={edition.saisie.tel} onChange={maj('tel')} />
            <ChampTexte className="pleine-largeur" libelle="Email" type="email" valeur={edition.saisie.email} onChange={maj('email')} erreur={erreurs.email} />
          </div>
        </Modale>
      )}
      {dialogue}
    </div>
  )
}
