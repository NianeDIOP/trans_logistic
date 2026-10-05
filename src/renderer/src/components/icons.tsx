/**
 * Jeu d'icônes de l'application, dessinées sur une grille de 24 px,
 * trait de 1,5 px, extrémités droites et angles légèrement arrondis.
 * La couleur suit `currentColor`.
 */
import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 24, children, ...rest }: IconProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="butt"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** Feuille à coin replié, lignes de texte et signe d'ajout. */
export function IconNouvelleFacture(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 21H6.25A1.25 1.25 0 0 1 5 19.75V4.25C5 3.56 5.56 3 6.25 3H14l5 5v5" />
      <path d="M14 3v5h5" />
      <path d="M8.5 11.5h6M8.5 14.75h3.5" />
      <path d="M18 15.5v6M15 18.5h6" />
    </Icon>
  )
}

/** Registre : feuilles empilées. */
export function IconHistorique(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <rect x="4" y="6" width="12.5" height="15" rx="1.25" />
      <path d="M7.5 3h11.25c.69 0 1.25.56 1.25 1.25V17.5" />
      <path d="M7.25 10.5h6M7.25 13.75h6M7.25 17h3.5" />
    </Icon>
  )
}

/** Axes, histogramme et courbe de tendance. */
export function IconTableauDeBord(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3.75 3.75v16.5h16.5" />
      <path d="M8 17v-3.5M12 17v-6M16 17V9.5" strokeWidth={2.25} />
      <path d="M7 9.25l4-3 3 1.75 5-4" />
    </Icon>
  )
}

/** Curseurs de réglage. */
export function IconParametres(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M3.5 6.5h9M17.5 6.5h3M3.5 12h3M11.5 12h9M3.5 17.5h7M15.5 17.5h5" />
      <rect x="12.5" y="4.5" width="5" height="4" rx="1" />
      <rect x="6.5" y="10" width="5" height="4" rx="1" />
      <rect x="10.5" y="15.5" width="5" height="4" rx="1" />
    </Icon>
  )
}

export function IconFlecheDroite(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" />
    </Icon>
  )
}

export function IconChevronGauche(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M14.5 6 8.5 12l6 6" />
    </Icon>
  )
}

/** Base de données locale (cylindre). */
export function IconBaseLocale(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5v13c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5v-13" />
      <path d="M5 12c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5" />
    </Icon>
  )
}

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
