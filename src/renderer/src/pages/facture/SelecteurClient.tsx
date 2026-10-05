import { useEffect, useMemo, useRef, useState } from 'react'
import { CaretDownIcon, MagnifyingGlassIcon, PlusIcon, UserCircleIcon } from '@phosphor-icons/react'
import type { Client, ClientSaisie } from '@shared/parametres'
import FormulaireClient from '../../components/FormulaireClient'
import Modale from '../../components/ui/Modale'
import { useNotifier } from '../../components/ui/Notifications'
import { appel, ErreurApi } from '../../lib/appel'

interface Props {
  id: string
  clients: Client[]
  /** Client de la facture (peut être désactivé depuis, ou absent de la liste). */
  valeur: number | null
  libelleCourant?: string
  onChange: (id: number) => void
  onClientCree: (client: Client) => void
  erreur?: string
}

const normaliser = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Liste déroulante avec recherche, et création rapide d'un client. */
export default function SelecteurClient({
  id,
  clients,
  valeur,
  libelleCourant,
  onChange,
  onClientCree,
  erreur
}: Props): React.JSX.Element {
  const notifier = useNotifier()
  const [ouvert, setOuvert] = useState(false)
  const [recherche, setRecherche] = useState('')
  const [actif, setActif] = useState(0)
  const [creation, setCreation] = useState<ClientSaisie | null>(null)
  const [erreursCreation, setErreursCreation] = useState<Record<string, string>>({})
  const conteneur = useRef<HTMLDivElement>(null)
  const champRecherche = useRef<HTMLInputElement>(null)

  const choisi = clients.find((c) => c.id === valeur)
  const filtres = useMemo(() => {
    const r = normaliser(recherche.trim())
    return r
      ? clients.filter((c) => normaliser(`${c.raison_sociale} ${c.ninea} ${c.tel}`).includes(r))
      : clients
  }, [clients, recherche])

  useEffect(() => {
    if (!ouvert) return
    champRecherche.current?.focus()
    const fermer = (e: MouseEvent): void => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', fermer)
    return () => document.removeEventListener('mousedown', fermer)
  }, [ouvert])

  useEffect(() => setActif(0), [recherche])

  const choisir = (c: Client): void => {
    onChange(c.id)
    setOuvert(false)
    setRecherche('')
  }

  const creer = async (): Promise<void> => {
    if (!creation) return
    try {
      const c = await appel(window.api.parametres.clients.creer(creation))
      onClientCree(c)
      onChange(c.id)
      setCreation(null)
      notifier(`Client « ${c.raison_sociale} » créé.`)
    } catch (err) {
      if (err instanceof ErreurApi) setErreursCreation(err.erreurs)
      else notifier((err as Error).message, 'erreur')
    }
  }

  const ouvrirCreation = (): void => {
    setOuvert(false)
    setErreursCreation({})
    setCreation({ raison_sociale: recherche.trim(), adresse: '', ninea: '', tel: '', email: '' })
    setRecherche('')
  }

  return (
    <div className="selecteur" ref={conteneur}>
      <button
        id={id}
        type="button"
        className={`saisie selecteur-bouton ${erreur ? 'saisie-invalide' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        onClick={() => setOuvert(!ouvert)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || (e.key.length === 1 && !e.ctrlKey && !e.altKey)) {
            e.preventDefault()
            setOuvert(true)
            if (e.key.length === 1) setRecherche(e.key)
          }
        }}
      >
        <UserCircleIcon size={20} weight="duotone" className="selecteur-icone" />
        {choisi || libelleCourant ? (
          <span className="selecteur-valeur">
            <strong>{choisi?.raison_sociale ?? libelleCourant}</strong>
            {choisi?.adresse && <span>{choisi.adresse}</span>}
          </span>
        ) : (
          <span className="selecteur-placeholder">Choisir un client…</span>
        )}
        <CaretDownIcon size={16} className="selecteur-caret" />
      </button>

      {ouvert && (
        <div className="selecteur-liste" role="listbox">
          <label className="selecteur-recherche">
            <MagnifyingGlassIcon size={18} />
            <input
              ref={champRecherche}
              placeholder="Rechercher un client"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActif((a) => Math.min(a + 1, filtres.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActif((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  if (filtres[actif]) choisir(filtres[actif])
                  else ouvrirCreation()
                } else if (e.key === 'Escape') {
                  e.stopPropagation()
                  setOuvert(false)
                }
              }}
            />
          </label>
          <ul>
            {filtres.map((c, i) => (
              <li
                key={c.id}
                role="option"
                aria-selected={c.id === valeur}
                className={`${i === actif ? 'actif' : ''} ${c.id === valeur ? 'choisi' : ''}`}
                onMouseEnter={() => setActif(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choisir(c)
                }}
              >
                <strong>{c.raison_sociale}</strong>
                <span>{[c.adresse, c.ninea && `NINEA ${c.ninea}`].filter(Boolean).join(' · ')}</span>
              </li>
            ))}
            {filtres.length === 0 && <li className="selecteur-vide">Aucun client trouvé.</li>}
          </ul>
          <button type="button" className="selecteur-creer" onMouseDown={(e) => e.preventDefault()} onClick={ouvrirCreation}>
            <PlusIcon size={16} weight="bold" />
            {recherche.trim() ? `Créer « ${recherche.trim()} »` : 'Nouveau client'}
          </button>
        </div>
      )}

      {creation && (
        <Modale
          titre="Nouveau client"
          sousTitre="Il sera aussi ajouté à la liste des clients dans Paramètres."
          onFermer={() => setCreation(null)}
          onValider={() => void creer()}
          largeur={600}
          pied={
            <>
              <button type="button" className="btn btn-secondaire" onClick={() => setCreation(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primaire">
                Créer et choisir
              </button>
            </>
          }
        >
          <FormulaireClient saisie={creation} onChange={setCreation} erreurs={erreursCreation} />
        </Modale>
      )}
    </div>
  )
}
