import { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircleIcon, WarningCircleIcon, XIcon } from '@phosphor-icons/react'

type Genre = 'succes' | 'erreur'
interface Notification {
  id: number
  genre: Genre
  message: string
}

type Notifier = (message: string, genre?: Genre) => void

const Contexte = createContext<Notifier>(() => undefined)

/** Notifications discrètes en bas à droite, effacées après quelques secondes. */
export function FournisseurNotifications({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [liste, setListe] = useState<Notification[]>([])

  const retirer = useCallback((id: number) => setListe((l) => l.filter((n) => n.id !== id)), [])

  const notifier = useCallback<Notifier>(
    (message, genre = 'succes') => {
      const id = Date.now() + Math.random()
      setListe((l) => [...l.slice(-3), { id, genre, message }])
      setTimeout(() => retirer(id), genre === 'erreur' ? 6000 : 3500)
    },
    [retirer]
  )

  return (
    <Contexte.Provider value={notifier}>
      {children}
      <div className="notifications" role="status" aria-live="polite">
        {liste.map((n) => (
          <div key={n.id} className={`notification notification-${n.genre}`}>
            {n.genre === 'succes' ? (
              <CheckCircleIcon size={20} weight="fill" />
            ) : (
              <WarningCircleIcon size={20} weight="fill" />
            )}
            <span>{n.message}</span>
            <button className="notification-fermer" aria-label="Fermer" onClick={() => retirer(n.id)}>
              <XIcon size={14} weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </Contexte.Provider>
  )
}

export function useNotifier(): Notifier {
  return useContext(Contexte)
}
