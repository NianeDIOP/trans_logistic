import { useState } from 'react'
import type { ResultatSuppression } from '@shared/parametres'
import Confirmation from '../components/ui/Confirmation'
import { useNotifier } from '../components/ui/Notifications'
import { appel } from './appel'
import type { Reponse } from '@shared/types'

interface Demande {
  nom: string
  action: () => Promise<Reponse<ResultatSuppression>>
}

/**
 * Suppression avec confirmation. Le message final indique si l'élément a été supprimé
 * ou seulement désactivé parce qu'une facture l'utilise déjà.
 */
export function useSuppression(apres: () => void): {
  demander: (d: Demande) => void
  dialogue: React.ReactNode
} {
  const notifier = useNotifier()
  const [demande, setDemande] = useState<Demande | null>(null)

  const confirmer = async (): Promise<void> => {
    if (!demande) return
    const d = demande
    setDemande(null)
    try {
      const r = await appel(d.action())
      notifier(
        r === 'supprime'
          ? `« ${d.nom} » a été supprimé.`
          : `« ${d.nom} » est utilisé par des factures : il a été désactivé.`
      )
      apres()
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    }
  }

  const dialogue = demande && (
    <Confirmation
      titre="Supprimer ?"
      danger
      libelleAction="Supprimer"
      message={
        <>
          <p>
            Supprimer <strong>« {demande.nom} »</strong> ?
          </p>
          <p className="texte-discret">
            S'il figure déjà sur une facture, il sera seulement désactivé : les factures existantes ne
            changent pas.
          </p>
        </>
      }
      onConfirmer={confirmer}
      onAnnuler={() => setDemande(null)}
    />
  )

  return { demander: setDemande, dialogue }
}
