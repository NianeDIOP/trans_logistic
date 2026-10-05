/**
 * Emblème compact de la marque (« 2M » or sur bleu roi), utilisé là où le logo
 * complet serait illisible : barre de titre, icône de l'application.
 */
interface Props {
  size?: number
}

export default function Emblem({ size = 20 }: Props): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="emb-fond" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f56cf" />
          <stop offset="1" stopColor="#0b2569" />
        </linearGradient>
        <linearGradient id="emb-or" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.5" stopColor="#f2b51d" />
          <stop offset="1" stopColor="#c48a0c" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#emb-fond)" />
      <path d="M5 47 C 20 57, 42 55, 59 35 C 45 50, 24 54, 5 47 Z" fill="url(#emb-or)" />
      <text
        x="31"
        y="41"
        textAnchor="middle"
        fontFamily="Montserrat"
        fontWeight="800"
        fontStyle="italic"
        fontSize="30"
        letterSpacing="-1"
        fill="url(#emb-or)"
      >
        2M
      </text>
    </svg>
  )
}
