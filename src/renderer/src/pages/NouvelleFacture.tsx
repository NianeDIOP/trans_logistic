import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CaretLeftIcon,
  EyeIcon,
  FilePlusIcon,
  FloppyDiskIcon,
  SealCheckIcon,
  TrashIcon
} from '@phosphor-icons/react'
import type { Facture, FactureSaisie, LigneSaisie, Referentiels } from '@shared/factures'
import { aujourdhui, estLigneConteneur, ligneVide } from '../../../core/facture'
import { calculerTotaux } from '../../../core/tva'
import { Champ } from '../components/ui/Champ'
import Confirmation from '../components/ui/Confirmation'
import Modale from '../components/ui/Modale'
import { useNotifier } from '../components/ui/Notifications'
import { appel, ErreurApi } from '../lib/appel'
import ApercuDocument from './facture/ApercuDocument'
import SelecteurClient from './facture/SelecteurClient'
import TableauLignes, { LIGNE_CONTENEUR } from './facture/TableauLignes'
import Totaux from './facture/Totaux'
import VueFacture from './facture/VueFacture'
import BadgeStatut from '../components/BadgeStatut'

interface Props {
  /** Brouillon ou facture à ouvrir ; absent pour une nouvelle facture. */
  factureId?: number | null
  /** Facture dont on reprend le client et les lignes (nouvelle facture datée du jour). */
  dupliquerDe?: number | null
  libelleRetour?: string
  onRetour: () => void
  /** Ouvre une autre facture (avoir, facture d'origine) ou une copie. */
  onOuvrir: (route: { factureId?: number; dupliquerDe?: number }) => void
}

function saisieVierge(ref: Referentiels | null): FactureSaisie {
  return {
    id: null,
    client_id: null,
    date: aujourdhui(),
    num_bl: '',
    notes: '',
    lignes: [{ ...LIGNE_CONTENEUR, nature: ref?.natures[0]?.code ?? null }]
  }
}

function versSaisie(f: Facture): FactureSaisie {
  return {
    id: f.id,
    client_id: f.client_id,
    date: f.date,
    num_bl: f.num_bl,
    notes: f.notes,
    lignes: f.lignes.map((l) => ({
      genre: estLigneConteneur(l) ? 'conteneur' : 'frais',
      num_conteneur: l.num_conteneur,
      type_conteneur: l.type_conteneur,
      zone: l.zone,
      nature: l.nature,
      designation: l.designation,
      montant_ht: l.montant_ht,
      soumis_tva: l.soumis_tva,
      prestation_id: l.prestation_id
    }))
  }
}

/** Empreinte comparable d'une saisie (lignes vides ignorées). */
const empreinte = (s: FactureSaisie): string =>
  JSON.stringify({ ...s, lignes: s.lignes.filter((l) => !ligneVide(l)).map(({ genre: _g, ...l }) => l) })

export default function NouvelleFacture({
  factureId = null,
  dupliquerDe = null,
  libelleRetour = 'Accueil',
  onRetour,
  onOuvrir
}: Props): React.JSX.Element {
  const notifier = useNotifier()
  const [referentiels, setReferentiels] = useState<Referentiels | null>(null)
  const [saisie, setSaisie] = useState<FactureSaisie>(() => saisieVierge(null))
  const [reference, setReference] = useState<string>(() => empreinte(saisieVierge(null)))
  const [emise, setEmise] = useState<{ facture: Facture; nouvelle: boolean } | null>(null)
  const [libelleClient, setLibelleClient] = useState<string | undefined>()
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [apercu, setApercu] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<'valider' | 'quitter' | 'supprimer' | null>(null)
  const [enCours, setEnCours] = useState(false)
  const saisieRef = useRef(saisie)
  saisieRef.current = saisie

  // Chargement des référentiels et, le cas échéant, de la facture à ouvrir.
  useEffect(() => {
    void (async () => {
      const ref = await appel(window.api.factures.referentiels())
      setReferentiels(ref)
      if (factureId !== null) {
        const f = await appel(window.api.factures.lire(factureId))
        if (f.statut !== 'brouillon') {
          setEmise({ facture: f, nouvelle: false })
          return
        }
        const s = versSaisie(f)
        setSaisie(s)
        setReference(empreinte(s))
        setLibelleClient(f.client_raison_sociale)
      } else if (dupliquerDe !== null) {
        // Copie : même client et mêmes lignes, datée du jour, sans numéro.
        const f = await appel(window.api.factures.lire(dupliquerDe))
        const s = { ...versSaisie(f), id: null, date: aujourdhui() }
        setSaisie(s)
        setReference(empreinte(saisieVierge(ref)))
        setLibelleClient(f.client_raison_sociale)
        notifier(`Copie de ${f.numero ?? 'la facture'} : vérifiez les montants avant de valider.`)
      } else {
        const s = saisieVierge(ref)
        setSaisie(s)
        setReference(empreinte(s))
      }
    })().catch((err: Error) => notifier(err.message, 'erreur'))
  }, [factureId, dupliquerDe, notifier])

  const totaux = useMemo(
    () =>
      calculerTotaux(
        saisie.lignes
          .filter((l) => !ligneVide(l))
          .map((l) => ({ montant_ht: Number.isSafeInteger(l.montant_ht) ? l.montant_ht : 0, soumis_tva: l.soumis_tva })),
        referentiels?.taux_tva ?? 18
      ),
    [saisie.lignes, referentiels]
  )

  const modifiee = empreinte(saisie) !== reference

  const maj = (modif: Partial<FactureSaisie>): void => {
    setSaisie((s) => ({ ...s, ...modif }))
    const champs = Object.keys(modif)
    if (champs.some((c) => erreurs[c] || (c === 'lignes' && Object.keys(erreurs).some((e) => e.startsWith('ligne'))))) {
      setErreurs((e) => {
        const copie = { ...e }
        for (const c of champs) delete copie[c]
        if (champs.includes('lignes')) for (const k of Object.keys(copie)) if (k.startsWith('ligne')) delete copie[k]
        return copie
      })
    }
  }

  const gererErreur = (err: unknown): void => {
    if (err instanceof ErreurApi && Object.keys(err.erreurs).length > 0) {
      setErreurs(err.erreurs)
      notifier(err.message, 'erreur')
    } else {
      notifier((err as Error).message, 'erreur')
    }
  }

  const enregistrer = useCallback(async (): Promise<void> => {
    setEnCours(true)
    try {
      const f = await appel(window.api.factures.enregistrer(saisieRef.current))
      const s = versSaisie(f)
      setSaisie(s)
      setReference(empreinte(s))
      setErreurs({})
      notifier('Brouillon enregistré.')
    } catch (err) {
      gererErreur(err)
    } finally {
      setEnCours(false)
    }
  }, [notifier])

  const valider = async (): Promise<void> => {
    setConfirmation(null)
    setEnCours(true)
    try {
      const f = await appel(window.api.factures.valider(saisie))
      setReference(empreinte(saisie))
      setEmise({ facture: f, nouvelle: true })
    } catch (err) {
      gererErreur(err)
    } finally {
      setEnCours(false)
    }
  }

  const ouvrirApercu = async (): Promise<void> => {
    try {
      setApercu(await appel(window.api.factures.apercu(saisie)))
    } catch (err) {
      gererErreur(err)
    }
  }

  const supprimer = async (): Promise<void> => {
    setConfirmation(null)
    if (saisie.id === null) return
    try {
      await appel(window.api.factures.supprimerBrouillon(saisie.id))
      notifier('Brouillon supprimé.')
      onRetour()
    } catch (err) {
      gererErreur(err)
    }
  }

  const nouvelleFacture = (): void => {
    const s = saisieVierge(referentiels)
    setEmise(null)
    setSaisie(s)
    setReference(empreinte(s))
    setErreurs({})
    setLibelleClient(undefined)
    void appel(window.api.factures.referentiels()).then(setReferentiels)
  }

  // Ctrl+S : enregistrer le brouillon.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's' && !emise) {
        e.preventDefault()
        if (!document.querySelector('.modale-fond')) void enregistrer()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enregistrer, emise])

  const retour = (): void => (modifiee && !emise ? setConfirmation('quitter') : onRetour())
  // Une facture émise se consulte : elle ne bloque ni Échap ni les raccourcis.
  const protegee = !emise

  const titre = emise
    ? `${emise.facture.type === 'avoir' ? 'Avoir' : 'Facture'} ${emise.facture.numero}`
    : saisie.id === null
      ? 'Nouvelle facture'
      : 'Brouillon de facture'

  return (
    <div className="ecran" data-saisie-protegee={protegee ? '' : undefined}>
      <header className="ecran-entete">
        <button className="bouton-retour" onClick={retour}>
          <CaretLeftIcon size={16} weight="bold" />
          {libelleRetour}
        </button>
        <span className="ecran-entete-icone">
          <FilePlusIcon size={22} weight="duotone" />
        </span>
        <h1>{titre}</h1>
        {!emise && <span className="badge badge-inactif">Brouillon</span>}
        {emise && <BadgeStatut facture={emise.facture} />}
        {!emise && modifiee && <span className="texte-modifie entete-etat">Modifications non enregistrées</span>}
      </header>

      {emise ? (
        <VueFacture
          facture={emise.facture}
          nouvelle={emise.nouvelle}
          onNouvelleFacture={nouvelleFacture}
          onChange={(facture) => setEmise({ facture, nouvelle: false })}
          onOuvrir={onOuvrir}
        />
      ) : !referentiels ? (
        <p className="chargement">Chargement…</p>
      ) : (
        <>
          <div className="facture-saisie">
            <section className="carte facture-entete">
              <Champ libelle="Client" obligatoire erreur={erreurs.client_id} className="facture-client">
                {(id) => (
                  <SelecteurClient
                    id={id}
                    clients={referentiels.clients}
                    valeur={saisie.client_id}
                    libelleCourant={libelleClient}
                    onChange={(client_id) => maj({ client_id })}
                    onClientCree={(c) => setReferentiels({ ...referentiels, clients: [...referentiels.clients, c] })}
                    erreur={erreurs.client_id}
                  />
                )}
              </Champ>
              <Champ libelle="Date" obligatoire erreur={erreurs.date}>
                {(id) => (
                  <input id={id} type="date" className="saisie" value={saisie.date} onChange={(e) => maj({ date: e.target.value })} />
                )}
              </Champ>
              <Champ libelle="N° BL" aide="Connaissement / bon de livraison">
                {(id) => (
                  <input
                    id={id}
                    className="saisie"
                    placeholder="ex. MEDU1234567"
                    value={saisie.num_bl}
                    onChange={(e) => maj({ num_bl: e.target.value })}
                  />
                )}
              </Champ>
            </section>

            <section className="carte carte-tableau facture-lignes">
              <h3 className="carte-titre">Conteneurs et prestations</h3>
              <TableauLignes
                lignes={saisie.lignes}
                referentiels={referentiels}
                erreurs={erreurs}
                onChange={(lignes: LigneSaisie[]) => maj({ lignes })}
              />
            </section>

            <section className="carte">
              <Totaux totaux={totaux} taux={referentiels.taux_tva} />
            </section>
          </div>

          <footer className="barre-actions">
            <div className="barre-actions-gauche">
              {saisie.id !== null && (
                <button className="btn btn-fantome" onClick={() => setConfirmation('supprimer')} disabled={enCours}>
                  <TrashIcon size={18} />
                  Supprimer le brouillon
                </button>
              )}
            </div>
            <button className="btn btn-secondaire" onClick={() => void ouvrirApercu()} disabled={enCours}>
              <EyeIcon size={18} weight="duotone" />
              Aperçu
            </button>
            <button className="btn btn-secondaire" onClick={() => void enregistrer()} disabled={enCours} title="Ctrl+S">
              <FloppyDiskIcon size={18} weight="duotone" />
              Enregistrer le brouillon
            </button>
            <button className="btn btn-primaire btn-valider" onClick={() => setConfirmation('valider')} disabled={enCours}>
              <SealCheckIcon size={18} weight="duotone" />
              Valider et générer le PDF
            </button>
          </footer>
        </>
      )}

      {apercu && (
        <Modale titre="Aperçu" sousTitre="Rendu de la facture telle qu'elle sera imprimée." onFermer={() => setApercu(null)} largeur={900}>
          <ApercuDocument html={apercu} />
        </Modale>
      )}

      {confirmation === 'valider' && (
        <Confirmation
          titre="Valider la facture ?"
          libelleAction="Valider et générer le PDF"
          message={
            <>
              <p>Un numéro définitif va être attribué et le PDF sera archivé.</p>
              <p className="texte-discret">
                Une facture validée ne peut plus être modifiée ni supprimée : seul un avoir pourra l’annuler.
              </p>
            </>
          }
          onConfirmer={() => void valider()}
          onAnnuler={() => setConfirmation(null)}
        />
      )}
      {confirmation === 'quitter' && (
        <Confirmation
          titre="Quitter sans enregistrer ?"
          danger
          libelleAction="Quitter sans enregistrer"
          message={<p>Les modifications de cette facture seront perdues. Vous pouvez aussi l’enregistrer comme brouillon.</p>}
          onConfirmer={() => {
            setConfirmation(null)
            onRetour()
          }}
          onAnnuler={() => setConfirmation(null)}
        />
      )}
      {confirmation === 'supprimer' && (
        <Confirmation
          titre="Supprimer le brouillon ?"
          danger
          libelleAction="Supprimer"
          message={<p>Ce brouillon n’a pas de numéro ; il sera définitivement supprimé.</p>}
          onConfirmer={() => void supprimer()}
          onAnnuler={() => setConfirmation(null)}
        />
      )}
    </div>
  )
}
