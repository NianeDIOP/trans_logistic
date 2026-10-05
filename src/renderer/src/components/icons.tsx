/**
 * Glyphes des contrôles de fenêtre (barre de titre personnalisée).
 * Les icônes de contenu proviennent de Phosphor (@phosphor-icons/react),
 * teintées aux couleurs de la marque.
 */

/* Contrôles de fenêtre : grille de 10 px, trait de 1 px, comme le système. */

function WindowGlyph({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function GlyphReduire(): React.JSX.Element {
  return (
    <WindowGlyph>
      <path d="M0 5.5h10" />
    </WindowGlyph>
  )
}

export function GlyphAgrandir(): React.JSX.Element {
  return (
    <WindowGlyph>
      <rect x="0.5" y="0.5" width="9" height="9" />
    </WindowGlyph>
  )
}

export function GlyphRestaurer(): React.JSX.Element {
  return (
    <WindowGlyph>
      <rect x="0.5" y="2.5" width="7" height="7" />
      <path d="M2.5 2.5V0.5h7v7h-2" />
    </WindowGlyph>
  )
}

export function GlyphFermer(): React.JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" />
    </svg>
  )
}
