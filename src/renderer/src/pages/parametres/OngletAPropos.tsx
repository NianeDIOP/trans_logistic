import { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/types'
import EnTeteSection from '../../components/ui/EnTeteSection'
import Emblem from '../../components/Emblem'

/** Informations sur l'application et son concepteur. */
export default function OngletAPropos(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  useEffect(() => {
    void window.api.getAppInfo().then(setInfo)
  }, [])

  return (
    <div className="onglet">
      <EnTeteSection titre="À propos" description="Application de facturation de 2M Logistique et Transport." />
      <section className="carte a-propos">
        <Emblem size={72} />
        <dl>
          <dt>Application</dt>
          <dd>2M Facturation</dd>
          <dt>Version</dt>
          <dd>{info ? `${info.version} (schéma ${info.schemaVersion})` : '—'}</dd>
          <dt>Conception et développement</dt>
          <dd>Niane Diop</dd>
          <dt>Contact</dt>
          <dd>77 158 89 03</dd>
          <dt>Données</dt>
          <dd>Enregistrées sur cet ordinateur, utilisables hors connexion.</dd>
        </dl>
      </section>
    </div>
  )
}
