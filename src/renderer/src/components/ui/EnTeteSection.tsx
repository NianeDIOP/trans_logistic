interface Props {
  titre: string
  description?: string
  actions?: React.ReactNode
}

export default function EnTeteSection({ titre, description, actions }: Props): React.JSX.Element {
  return (
    <header className="section-entete">
      <div>
        <h2>{titre}</h2>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </header>
  )
}
