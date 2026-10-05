interface Props {
  genre: 'actif' | 'inactif' | 'tva' | 'hors-tva'
  children: React.ReactNode
}

export default function Badge({ genre, children }: Props): React.JSX.Element {
  return <span className={`badge badge-${genre}`}>{children}</span>
}
