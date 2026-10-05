/**
 * Marque 2M : un conteneur vu de profil (nervures verticales)
 * posé sur la bande de couleur de la société.
 */
interface Props {
  size?: number
  /** `plein` : pastille foncée (icône) ; `trait` : dessin seul sur fond foncé. */
  variante?: 'plein' | 'trait'
}

export default function Logo({ size = 32, variante = 'plein' }: Props): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {variante === 'plein' && <rect width="64" height="64" rx="10" fill="var(--encre)" />}
      <rect x="11" y="19" width="42" height="24" rx="1.5" fill="none" stroke="#f4f2ed" strokeWidth="3" />
      <path d="M19 24v14M25.5 24v14M32 24v14M38.5 24v14M45 24v14" stroke="#f4f2ed" strokeWidth="2" />
      <rect x="11" y="47" width="42" height="3.5" fill="var(--signal)" />
    </svg>
  )
}
