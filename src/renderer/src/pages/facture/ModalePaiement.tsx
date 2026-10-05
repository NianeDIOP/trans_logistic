import { useEffect, useState } from 'react'
import type { Facture } from '@shared/factures'
import type { ElementListe } from '@shared/parametres'
import { aujourdhui } from '../../../../core/facture'
import { formatMontant } from '../../../../core/montants'
import { Champ, ChampMontant, ChampTexte } from '../../components/ui/Champ'
import Modale from '../../components/ui/Modale'
import { useNotifier } from '../../components/ui/Notifications'
import { appel, ErreurApi } from '../../lib/appel'

interface Props {
  facture: Facture
  onFermer: () => void
  onEnregistre: (facture: Facture) => void
}

export default function ModalePaiement({ facture, onFermer, onEnregistre }: Props): React.JSX.Element {
  const notifier = useNotifier()
  const reste = facture.total_ttc - facture.regle
  const [modes, setModes] = useState<ElementListe[]>([])
  const [date, setDate] = useState(aujourdhui())
  const [montant, setMontant] = useState<number | null>(reste)
  const [mode, setMode] = useState('')
  const [reference, setReference] = useState('')
  const [erreurs, setErreurs] = useState<Record<string, string>>({})

  useEffect(() => {
    appel(window.api.factures.modesPaiement())
      .then((m) => {
        setModes(m)
        setMode((courant) => courant || m[0]?.code || '')
      })
      .catch((err: Error) => notifier(err.message, 'erreur'))
  }, [notifier])

  const enregistrer = async (): Promise<void> => {
    try {
      const f = await appel(
        window.api.factures.enregistrerPaiement(facture.id, { date, montant: montant ?? 0, mode, reference })
      )
      notifier(f.statut === 'payee' ? 'Règlement enregistré : facture soldée.' : 'Règlement enregistré.')
      onEnregistre(f)
    } catch (err) {
      if (err instanceof ErreurApi) setErreurs(err.erreurs)
      else notifier((err as Error).message, 'erreur')
    }
  }

  return (
    <Modale
      titre="Enregistrer un règlement"
      sousTitre={`Facture ${facture.numero} — ${facture.client_raison_sociale}`}
      onFermer={onFermer}
      onValider={() => void enregistrer()}
      largeur={520}
      pied={
        <>
          <button type="button" className="btn btn-secondaire" onClick={onFermer}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primaire">
            Enregistrer le règlement
          </button>
        </>
      }
    >
      <div className="recap-reglement">
        <div>
          <span>Total TTC</span>
          <strong>{formatMontant(facture.total_ttc)}</strong>
        </div>
        <div>
          <span>Déjà réglé</span>
          <strong>{formatMontant(facture.regle)}</strong>
        </div>
        <div className="recap-reste">
          <span>Reste à payer</span>
          <strong>{formatMontant(reste)} FCFA</strong>
        </div>
      </div>
      <div className="grille-champs">
        <ChampMontant libelle="Montant reçu" obligatoire valeur={montant} onChange={setMontant} erreur={erreurs.montant} />
        <Champ libelle="Date" obligatoire erreur={erreurs.date}>
          {(id) => <input id={id} type="date" className="saisie" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Champ>
        <Champ libelle="Mode de paiement" obligatoire erreur={erreurs.mode}>
          {(id) => (
            <select id={id} className="saisie" value={mode} onChange={(e) => setMode(e.target.value)}>
              {modes.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.libelle}
                </option>
              ))}
            </select>
          )}
        </Champ>
        <ChampTexte libelle="Référence" placeholder="N° de chèque, de transaction…" valeur={reference} onChange={setReference} />
      </div>
    </Modale>
  )
}
