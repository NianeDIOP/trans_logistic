import { useEffect, useState } from 'react'
import { FloppyDiskIcon, ImageIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import type { Entreprise } from '@shared/types'
import type { EntrepriseSaisie, TypeImage } from '@shared/parametres'
import { formatNumero } from '../../../../core/numerotation'
import { Champ, ChampTexte } from '../../components/ui/Champ'
import EnTeteSection from '../../components/ui/EnTeteSection'
import { useNotifier } from '../../components/ui/Notifications'
import { appel, ErreurApi } from '../../lib/appel'
import logoParDefaut from '../../../../../resources/logo-2m.png'

const CHAMPS: (keyof EntrepriseSaisie)[] = [
  'raison_sociale', 'rc', 'ninea', 'banque', 'iban', 'siege', 'adresse',
  'email', 'tel', 'taux_tva', 'prefixe_facture', 'mentions'
]

function versSaisie(e: Entreprise): EntrepriseSaisie {
  return Object.fromEntries(CHAMPS.map((c) => [c, e[c]])) as EntrepriseSaisie
}

interface Props {
  /** Signale au parent des modifications non enregistrées. */
  onModifie: (modifie: boolean) => void
}

export default function OngletEntreprise({ onModifie }: Props): React.JSX.Element {
  const notifier = useNotifier()
  const [initial, setInitial] = useState<EntrepriseSaisie | null>(null)
  const [saisie, setSaisie] = useState<EntrepriseSaisie | null>(null)
  const [erreurs, setErreurs] = useState<Record<string, string>>({})
  const [images, setImages] = useState<Record<TypeImage, string | null>>({ logo: null, cachet: null })
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    void (async () => {
      const e = await appel(window.api.parametres.entreprise.lire())
      setInitial(versSaisie(e))
      setSaisie(versSaisie(e))
      const [logo, cachet] = await Promise.all([
        appel(window.api.parametres.entreprise.lireImage('logo')),
        appel(window.api.parametres.entreprise.lireImage('cachet'))
      ])
      setImages({ logo, cachet })
    })().catch((err: Error) => notifier(err.message, 'erreur'))
  }, [notifier])

  const modifie = initial !== null && saisie !== null && CHAMPS.some((c) => initial[c] !== saisie[c])
  useEffect(() => onModifie(modifie), [modifie, onModifie])

  if (!saisie) return <p className="chargement">Chargement…</p>

  const maj = <K extends keyof EntrepriseSaisie>(champ: K) => (valeur: EntrepriseSaisie[K]) => {
    setSaisie({ ...saisie, [champ]: valeur })
    if (erreurs[champ]) setErreurs({ ...erreurs, [champ]: '' })
  }

  const enregistrer = async (): Promise<void> => {
    setEnCours(true)
    try {
      const e = await appel(window.api.parametres.entreprise.modifier(saisie))
      setInitial(versSaisie(e))
      setSaisie(versSaisie(e))
      setErreurs({})
      notifier('Informations de la société enregistrées.')
    } catch (err) {
      if (err instanceof ErreurApi) {
        setErreurs(err.erreurs)
        // Amène le premier champ en erreur à l'écran.
        requestAnimationFrame(() => {
          const champ = document.querySelector<HTMLElement>('.champ-erreur')
          champ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          champ?.querySelector<HTMLElement>('input, textarea')?.focus({ preventScroll: true })
        })
      }
      notifier((err as Error).message, 'erreur')
    } finally {
      setEnCours(false)
    }
  }

  const choisirImage = async (type: TypeImage): Promise<void> => {
    try {
      const url = await appel(window.api.parametres.entreprise.choisirImage(type))
      if (url) {
        setImages((i) => ({ ...i, [type]: url }))
        notifier(type === 'logo' ? 'Logo mis à jour.' : 'Cachet mis à jour.')
      }
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    }
  }

  const retirerImage = async (type: TypeImage): Promise<void> => {
    try {
      await appel(window.api.parametres.entreprise.retirerImage(type))
      setImages((i) => ({ ...i, [type]: null }))
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    }
  }

  let apercuNumero = '—'
  try {
    apercuNumero = formatNumero(saisie.prefixe_facture.trim().toUpperCase() || '?', new Date().getFullYear(), 1)
  } catch {
    /* préfixe en cours de saisie */
  }

  return (
    <form
      className="onglet"
      onSubmit={(e) => {
        e.preventDefault()
        void enregistrer()
      }}
    >
      <EnTeteSection
        titre="Société"
        description="Ces informations figurent sur l'en-tête et le pied de chaque facture."
        actions={
          <>
            {modifie && <span className="texte-modifie">Modifications non enregistrées</span>}
            <button type="submit" className="btn btn-primaire" disabled={!modifie || enCours}>
              <FloppyDiskIcon size={18} weight="duotone" />
              Enregistrer
            </button>
          </>
        }
      />

      <div className="carte">
        <h3 className="carte-titre">Identité</h3>
        <div className="grille-champs">
          <ChampTexte className="pleine-largeur" libelle="Raison sociale" obligatoire valeur={saisie.raison_sociale} onChange={maj('raison_sociale')} erreur={erreurs.raison_sociale} />
          <ChampTexte libelle="Registre du commerce (RC)" valeur={saisie.rc} onChange={maj('rc')} />
          <ChampTexte libelle="NINEA" valeur={saisie.ninea} onChange={maj('ninea')} />
        </div>
      </div>

      <div className="carte">
        <h3 className="carte-titre">Coordonnées</h3>
        <div className="grille-champs">
          <ChampTexte libelle="Adresse" valeur={saisie.adresse} onChange={maj('adresse')} />
          <ChampTexte libelle="Siège opérationnel" valeur={saisie.siege} onChange={maj('siege')} />
          <ChampTexte libelle="Téléphone" valeur={saisie.tel} onChange={maj('tel')} />
          <ChampTexte libelle="Email" type="email" valeur={saisie.email} onChange={maj('email')} erreur={erreurs.email} />
        </div>
      </div>

      <div className="carte">
        <h3 className="carte-titre">Banque</h3>
        <div className="grille-champs">
          <ChampTexte libelle="Banque" valeur={saisie.banque} onChange={maj('banque')} />
          <ChampTexte libelle="N° de compte / IBAN" valeur={saisie.iban} onChange={maj('iban')} />
        </div>
      </div>

      <div className="carte">
        <h3 className="carte-titre">Facturation</h3>
        <div className="grille-champs">
          <Champ libelle="Taux de TVA" obligatoire erreur={erreurs.taux_tva} aide="Appliqué aux lignes cochées « TVA ».">
            {(id) => (
              <div className="saisie-montant">
                <input
                  id={id}
                  className="saisie"
                  inputMode="numeric"
                  value={Number.isNaN(saisie.taux_tva) ? '' : String(saisie.taux_tva)}
                  onChange={(e) => maj('taux_tva')(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                />
                <span className="saisie-unite">%</span>
              </div>
            )}
          </Champ>
          <ChampTexte
            libelle="Préfixe des factures"
            obligatoire
            valeur={saisie.prefixe_facture}
            onChange={maj('prefixe_facture')}
            erreur={erreurs.prefixe_facture}
            aide={`Prochain numéro de l'année : ${apercuNumero}`}
            maxLength={10}
          />
          <Champ className="pleine-largeur" libelle="Mentions de bas de facture" aide="Conditions de paiement, délais, remerciements… (plusieurs lignes possibles)">
            {(id) => (
              <textarea id={id} className="saisie" rows={3} value={saisie.mentions} onChange={(e) => maj('mentions')(e.target.value)} />
            )}
          </Champ>
        </div>
      </div>

      <div className="carte">
        <h3 className="carte-titre">Logo et cachet</h3>
        <div className="grille-images">
          {(['logo', 'cachet'] as const).map((type) => (
            <div key={type} className="bloc-image">
              <div className="bloc-image-apercu">
                {images[type] ? (
                  <img src={images[type]!} alt="" />
                ) : type === 'logo' ? (
                  <img src={logoParDefaut} alt="" className="image-defaut" />
                ) : (
                  <span className="bloc-image-vide">
                    <ImageIcon size={36} weight="duotone" />
                    Aucun cachet
                  </span>
                )}
              </div>
              <div className="bloc-image-infos">
                <strong>{type === 'logo' ? 'Logo' : 'Cachet et signature'}</strong>
                <p className="texte-discret">
                  {type === 'logo'
                    ? images.logo
                      ? 'Logo personnalisé.'
                      : 'Logo officiel 2M utilisé par défaut.'
                    : 'Image apposée dans la zone « cachet et signature » du PDF.'}
                </p>
                <div className="bloc-image-actions">
                  <button type="button" className="btn btn-secondaire" onClick={() => void choisirImage(type)}>
                    <UploadSimpleIcon size={16} weight="bold" />
                    Choisir une image
                  </button>
                  {images[type] && (
                    <button type="button" className="btn btn-fantome" onClick={() => void retirerImage(type)}>
                      <TrashIcon size={16} />
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="texte-discret">PNG, JPEG ou WebP, 5 Mo maximum. Un PNG à fond transparent donne le meilleur rendu.</p>
      </div>
    </form>
  )
}
