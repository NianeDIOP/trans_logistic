import type { Reponse } from '@shared/types'

/** Erreur renvoyée par le processus principal (message + erreurs par champ). */
export class ErreurApi extends Error {
  constructor(
    message: string,
    public readonly erreurs: Record<string, string> = {}
  ) {
    super(message)
    this.name = 'ErreurApi'
  }
}

/** Attend une réponse IPC et renvoie ses données, ou lève une `ErreurApi`. */
export async function appel<T>(reponse: Promise<Reponse<T>>): Promise<T> {
  const r = await reponse
  if (!r.ok) throw new ErreurApi(r.message, r.erreurs)
  return r.data
}
