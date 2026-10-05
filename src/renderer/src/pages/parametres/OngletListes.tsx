import { useCallback, useEffect, useState } from 'react'
import {
  ArrowCounterClockwiseIcon,
  CreditCardIcon,
  PencilSimpleIcon,
  PlusIcon,
  ShippingContainerIcon,
  TagIcon,
  TrashIcon,
  type Icon
} from '@phosphor-icons/react'
import type { ElementListe, NomListe } from '@shared/parametres'
import { ChampTexte } from '../../components/ui/Champ'
import EnTeteSection from '../../components/ui/EnTeteSection'
import Modale from '../../components/ui/Modale'
import { useNotifier } from '../../components/ui/Notifications'
import { appel, ErreurApi } from '../../lib/appel'
import { useSuppression } from '../../lib/useSuppression'

const LISTES: { nom: NomListe; titre: string; aide: string; exemple: string; Icone: Icon }[] = [
  {
    nom: 'types_conteneurs',
    titre: 'Types de conteneurs',
    aide: 'Colonnes de la grille tarifaire.',
    exemple: "ex. 40' HC",
    Icone: ShippingContainerIcon
  },
  {
    nom: 'natures',
    titre: 'Natures',
    aide: 'Nature de l’opération sur chaque ligne.',
    exemple: 'ex. Transit',
    Icone: TagIcon
  },
  {
    nom: 'modes_paiement',
    titre: 'Modes de paiement',
    aide: 'Proposés lors de l’enregistrement d’un règlement.',
    exemple: 'ex. Free Money',
    Icone: CreditCardIcon
  }
]

function CarteListe({ liste }: { liste: (typeof LISTES)[number] }): React.JSX.Element {
  const notifier = useNotifier()
  const [elements, setElements] = useState<ElementListe[]>([])
  const [nouveau, setNouveau] = useState('')
  const [erreurAjout, setErreurAjout] = useState('')
  const [edition, setEdition] = useState<{ element: ElementListe; libelle: string } | null>(null)
  const [erreurEdition, setErreurEdition] = useState('')

  const charger = useCallback(() => {
    appel(window.api.parametres.listes.lister(liste.nom, true))
      .then(setElements)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [liste.nom, notifier])

  useEffect(charger, [charger])

  const { demander, dialogue } = useSuppression(charger)

  const ajouter = async (): Promise<void> => {
    try {
      await appel(window.api.parametres.listes.ajouter(liste.nom, nouveau))
      setNouveau('')
      setErreurAjout('')
      charger()
    } catch (err) {
      setErreurAjout(err instanceof ErreurApi ? (err.erreurs.libelle ?? err.message) : (err as Error).message)
    }
  }

  const renommer = async (): Promise<void> => {
    if (!edition) return
    try {
      await appel(window.api.parametres.listes.renommer(liste.nom, edition.element.id, edition.libelle))
      setEdition(null)
      charger()
    } catch (err) {
      setErreurEdition(err instanceof ErreurApi ? (err.erreurs.libelle ?? err.message) : (err as Error).message)
    }
  }

  const reactiver = async (e: ElementListe): Promise<void> => {
    await appel(window.api.parametres.listes.reactiver(liste.nom, e.id)).catch(() => undefined)
    charger()
  }

  return (
    <section className="carte carte-liste">
      <header className="carte-liste-entete">
        <span className="pastille">
          <liste.Icone size={20} weight="duotone" />
        </span>
        <div>
          <h3>{liste.titre}</h3>
          <p className="texte-discret">{liste.aide}</p>
        </div>
      </header>

      <ul className="liste-elements">
        {elements.map((e) => (
          <li key={e.id} className={e.actif ? '' : 'ligne-inactive'}>
            <span className="liste-libelle">{e.libelle}</span>
            {!e.actif && <span className="badge badge-inactif">Désactivé</span>}
            <span className="liste-actions">
              <button
                className="btn-icone"
                title="Renommer"
                onClick={() => {
                  setErreurEdition('')
                  setEdition({ element: e, libelle: e.libelle })
                }}
              >
                <PencilSimpleIcon size={16} />
              </button>
              {e.actif ? (
                <button
                  className="btn-icone btn-icone-danger"
                  title="Supprimer"
                  onClick={() => demander({ nom: e.libelle, action: () => window.api.parametres.listes.supprimer(liste.nom, e.id) })}
                >
                  <TrashIcon size={16} />
                </button>
              ) : (
                <button className="btn-icone" title="Réactiver" onClick={() => void reactiver(e)}>
                  <ArrowCounterClockwiseIcon size={16} />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <form
        className="liste-ajout"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void ajouter()
        }}
      >
        <input
          className={`saisie ${erreurAjout ? 'saisie-invalide' : ''}`}
          placeholder={liste.exemple}
          value={nouveau}
          onChange={(e) => {
            setNouveau(e.target.value)
            setErreurAjout('')
          }}
          aria-label={`Ajouter à ${liste.titre}`}
        />
        <button type="submit" className="btn btn-secondaire" disabled={!nouveau.trim()}>
          <PlusIcon size={16} weight="bold" />
          Ajouter
        </button>
      </form>
      {erreurAjout && <p className="champ-message">{erreurAjout}</p>}

      {edition && (
        <Modale
          titre="Renommer"
          sousTitre="Le nouveau libellé s'applique aux prochaines factures ; les factures existantes ne changent pas."
          onFermer={() => setEdition(null)}
          onValider={() => void renommer()}
          largeur={440}
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
          <ChampTexte
            libelle="Libellé"
            obligatoire
            valeur={edition.libelle}
            onChange={(v) => {
              setEdition({ ...edition, libelle: v })
              setErreurEdition('')
            }}
            erreur={erreurEdition}
          />
        </Modale>
      )}
      {dialogue}
    </section>
  )
}

export default function OngletListes(): React.JSX.Element {
  return (
    <div className="onglet">
      <EnTeteSection
        titre="Listes"
        description="Valeurs proposées dans les listes déroulantes de la facture et des règlements."
      />
      <div className="grille-listes">
        {LISTES.map((l) => (
          <CarteListe key={l.nom} liste={l} />
        ))}
      </div>
    </div>
  )
}
