import { useEffect, useId, useRef, useState } from 'react'
import { formatMontant, lireMontant } from '../../../../core/montants'

interface ChampProps {
  libelle: string
  erreur?: string
  aide?: string
  obligatoire?: boolean
  className?: string
  children: (id: string) => React.ReactNode
}

/** Habillage d'un champ : libellé, contrôle, aide ou message d'erreur. */
export function Champ({ libelle, erreur, aide, obligatoire, className, children }: ChampProps): React.JSX.Element {
  const id = useId()
  return (
    <div className={`champ ${erreur ? 'champ-erreur' : ''} ${className ?? ''}`}>
      <label htmlFor={id}>
        {libelle}
        {obligatoire && <span className="champ-obligatoire"> *</span>}
      </label>
      {children(id)}
      {erreur ? <p className="champ-message">{erreur}</p> : aide && <p className="champ-aide">{aide}</p>}
    </div>
  )
}

type TexteProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  libelle: string
  valeur: string
  onChange: (v: string) => void
  erreur?: string
  aide?: string
  obligatoire?: boolean
}

export function ChampTexte({ libelle, valeur, onChange, erreur, aide, obligatoire, className, ...rest }: TexteProps): React.JSX.Element {
  return (
    <Champ libelle={libelle} erreur={erreur} aide={aide} obligatoire={obligatoire} className={className}>
      {(id) => (
        <input id={id} className="saisie" value={valeur} onChange={(e) => onChange(e.target.value)} {...rest} />
      )}
    </Champ>
  )
}

interface SaisieMontantProps {
  id?: string
  valeur: number | null
  onChange: (v: number | null) => void
  /** Signale une saisie qui n'est pas un montant entier positif. */
  onInvalide?: (invalide: boolean) => void
  placeholder?: string
  className?: string
  'aria-label'?: string
  unite?: boolean
}

/** Champ de montant en FCFA : séparateur de milliers à la sortie du champ, entier positif uniquement. */
export function SaisieMontant({
  id,
  valeur,
  onChange,
  onInvalide,
  placeholder,
  className,
  unite = true,
  ...rest
}: SaisieMontantProps): React.JSX.Element {
  const [texte, setTexte] = useState(valeur === null ? '' : formatMontant(valeur))
  const [invalide, setInvalide] = useState(false)
  const enSaisie = useRef(false)

  // Resynchronise l'affichage quand la valeur change de l'extérieur (pas pendant la frappe).
  useEffect(() => {
    if (!enSaisie.current) setTexte(valeur === null ? '' : formatMontant(valeur))
  }, [valeur])

  return (
    <div className={`saisie-montant ${unite ? '' : 'sans-unite'}`}>
      <input
        id={id}
        className={`saisie ${invalide ? 'saisie-invalide' : ''} ${className ?? ''}`}
        inputMode="numeric"
        placeholder={placeholder}
        value={texte}
        aria-label={rest['aria-label']}
        onChange={(e) => {
          const brut = e.target.value
          setTexte(brut)
          const n = brut.trim() === '' ? null : lireMontant(brut)
          const faux = brut.trim() !== '' && (n === null || n < 0)
          setInvalide(faux)
          onInvalide?.(faux)
          if (brut.trim() === '') onChange(null)
          else if (n !== null && n >= 0) onChange(n)
        }}
        onFocus={(e) => {
          enSaisie.current = true
          e.target.select()
        }}
        onBlur={() => {
          enSaisie.current = false
          if (!invalide) setTexte(valeur === null ? '' : formatMontant(valeur))
        }}
      />
      {unite && <span className="saisie-unite">FCFA</span>}
    </div>
  )
}

interface MontantProps {
  libelle: string
  valeur: number | null
  onChange: (v: number | null) => void
  erreur?: string
  aide?: string
  obligatoire?: boolean
  placeholder?: string
  className?: string
}

export function ChampMontant({ libelle, valeur, onChange, erreur, aide, obligatoire, placeholder, className }: MontantProps): React.JSX.Element {
  const [invalide, setInvalide] = useState(false)
  return (
    <Champ
      libelle={libelle}
      erreur={erreur ?? (invalide ? 'Montant entier attendu (ex. 70 000).' : undefined)}
      aide={aide}
      obligatoire={obligatoire}
      className={className}
    >
      {(id) => (
        <SaisieMontant id={id} valeur={valeur} onChange={onChange} onInvalide={setInvalide} placeholder={placeholder} />
      )}
    </Champ>
  )
}
