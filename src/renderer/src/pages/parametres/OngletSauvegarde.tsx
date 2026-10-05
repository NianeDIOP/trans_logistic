import { useCallback, useEffect, useState } from 'react'
import {
  ArrowCounterClockwiseIcon,
  ClockClockwiseIcon,
  FolderOpenIcon,
  HardDrivesIcon,
  ShieldCheckIcon,
  WarningIcon
} from '@phosphor-icons/react'
import type { ApercuSauvegarde, InfosSauvegarde } from '@shared/sauvegarde'
import Confirmation from '../../components/ui/Confirmation'
import EnTeteSection from '../../components/ui/EnTeteSection'
import { useNotifier } from '../../components/ui/Notifications'
import { appel } from '../../lib/appel'

const dateHeure = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' })
const taille = (octets: number): string =>
  octets >= 1024 * 1024 ? `${(octets / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo` : `${Math.ceil(octets / 1024)} Ko`

export default function OngletSauvegarde(): React.JSX.Element {
  const notifier = useNotifier()
  const [infos, setInfos] = useState<InfosSauvegarde | null>(null)
  const [aRestaurer, setARestaurer] = useState<ApercuSauvegarde | null>(null)
  const [enCours, setEnCours] = useState(false)

  const charger = useCallback(() => {
    appel(window.api.sauvegarde.infos())
      .then(setInfos)
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [notifier])

  useEffect(charger, [charger])

  const sauvegarder = async (): Promise<void> => {
    setEnCours(true)
    try {
      const chemin = await appel(window.api.sauvegarde.sauvegarder())
      if (chemin) notifier(`Sauvegarde enregistrée : ${chemin}`)
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    } finally {
      setEnCours(false)
    }
  }

  const preparer = async (chemin?: string): Promise<void> => {
    try {
      const apercu = await appel(chemin ? window.api.sauvegarde.examiner(chemin) : window.api.sauvegarde.choisir())
      if (apercu) setARestaurer(apercu)
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    }
  }

  const restaurer = async (): Promise<void> => {
    if (!aRestaurer) return
    const chemin = aRestaurer.chemin
    setARestaurer(null)
    setEnCours(true)
    try {
      await appel(window.api.sauvegarde.restaurer(chemin))
      // L'application redémarre d'elle-même.
    } catch (err) {
      notifier((err as Error).message, 'erreur')
      setEnCours(false)
    }
  }

  return (
    <div className="onglet">
      <EnTeteSection
        titre="Sauvegarde et restauration"
        description="Toutes les factures, les clients et les paramètres tiennent dans un seul fichier. Gardez-en une copie hors de l’ordinateur."
      />

      <div className="grille-sauvegarde">
        <section className="carte bloc-sauvegarde">
          <span className="pastille">
            <HardDrivesIcon size={20} weight="duotone" />
          </span>
          <div>
            <h3>Sauvegarder maintenant</h3>
            <p className="texte-discret">
              Copie complète vers le dossier de votre choix : clé USB, disque externe ou dossier synchronisé (Google Drive,
              OneDrive…).
            </p>
          </div>
          <button className="btn btn-primaire" onClick={() => void sauvegarder()} disabled={enCours}>
            <HardDrivesIcon size={18} weight="duotone" />
            Choisir le dossier et sauvegarder
          </button>
        </section>

        <section className="carte bloc-sauvegarde">
          <span className="pastille">
            <ArrowCounterClockwiseIcon size={20} weight="duotone" />
          </span>
          <div>
            <h3>Restaurer une sauvegarde</h3>
            <p className="texte-discret">
              Remplace toutes les données actuelles par celles de la sauvegarde. Une copie de sécurité des données actuelles est
              faite avant.
            </p>
          </div>
          <button className="btn btn-secondaire" onClick={() => void preparer()} disabled={enCours}>
            <FolderOpenIcon size={18} weight="duotone" />
            Choisir un fichier de sauvegarde…
          </button>
        </section>
      </div>

      <section className="carte carte-tableau">
        <header className="sauvegardes-entete">
          <div>
            <h3 className="carte-titre">
              <ShieldCheckIcon size={18} weight="duotone" /> Sauvegardes automatiques
            </h3>
            <p className="texte-discret">
              Une copie par jour, au démarrage de l’application ; les 10 plus récentes sont conservées sur cet ordinateur.
            </p>
          </div>
          <button className="btn btn-secondaire" onClick={() => void appel(window.api.sauvegarde.ouvrirDossier())}>
            <FolderOpenIcon size={16} weight="duotone" />
            Ouvrir le dossier
          </button>
        </header>
        {infos && infos.automatiques.length === 0 ? (
          <div className="vide">
            <ClockClockwiseIcon size={36} weight="duotone" />
            <p>La première sauvegarde automatique sera faite au prochain démarrage.</p>
          </div>
        ) : (
          <table className="tableau">
            <thead>
              <tr>
                <th>Date</th>
                <th>Fichier</th>
                <th className="col-montant">Taille</th>
                <th className="col-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {infos?.automatiques.map((f) => (
                <tr key={f.nom}>
                  <td>
                    <strong>{dateHeure.format(new Date(f.date))}</strong>
                    {f.nom.includes('avant-restauration') && <span className="sous-ligne">Copie de sécurité avant restauration</span>}
                  </td>
                  <td className="texte-discret">{f.nom}</td>
                  <td className="col-montant">{taille(f.taille)}</td>
                  <td className="col-actions">
                    <button className="btn btn-fantome" onClick={() => void preparer(f.chemin)} disabled={enCours}>
                      <ArrowCounterClockwiseIcon size={16} />
                      Restaurer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {aRestaurer && (
        <Confirmation
          titre="Restaurer cette sauvegarde ?"
          danger
          libelleAction="Restaurer et redémarrer"
          message={
            <>
              <dl className="apercu-sauvegarde">
                <div>
                  <dt>Société</dt>
                  <dd>{aRestaurer.raison_sociale || '—'}</dd>
                </div>
                <div>
                  <dt>Factures émises</dt>
                  <dd>{aRestaurer.nb_factures}</dd>
                </div>
                <div>
                  <dt>Clients</dt>
                  <dd>{aRestaurer.nb_clients}</dd>
                </div>
                <div>
                  <dt>Dernière facture</dt>
                  <dd>{aRestaurer.derniere_facture ?? '—'}</dd>
                </div>
              </dl>
              <p className="avertissement">
                <WarningIcon size={18} weight="fill" />
                Les données actuelles seront remplacées. Une copie de sécurité est faite avant, et l’application redémarre.
              </p>
            </>
          }
          onConfirmer={() => void restaurer()}
          onAnnuler={() => setARestaurer(null)}
        />
      )}
    </div>
  )
}
