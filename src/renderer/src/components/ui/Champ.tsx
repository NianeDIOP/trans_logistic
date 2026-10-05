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

/** Saisie d'un montant en FCFA : séparateur de milliers à la sortie du champ, entier uniquement. */
export function ChampMontant({ libelle, valeur, onChange, erreur, aide, obligatoire, placeholder, className }: MontantProps): React.JSX.Element {
  const [texte, setTexte] = useState(valeur === null ? '' : formatMontant(valeur))
  const [invalide, setInvalide] = useState(false)
  const enSaisie = useRef(false)

  // Resynchronise l'affichage quand la valeur change de l'extérieur (pas pendant la frappe).
  useEffect(() => {
    if (!enSaisie.current) setTexte(valeur === null ? '' : formatMontant(valeur))
  }, [valeur])

  return (
    <Champ
      libelle={libelle}
      erreur={erreur ?? (invalide ? 'Montant entier attendu (ex. 70 000).' : undefined)}
      aide={aide}
      obligatoire={obligatoire}
      className={className}
    >
      {(id) => (
        <div className="saisie-montant">
          <input
            id={id}
            className="saisie"
            inputMode="numeric"
            placeholder={placeholder}
            value={texte}
            onChange={(e) => {
              setTexte(e.target.value)
              const n = e.target.value.trim() === '' ? null : lireMontant(e.target.value)
              setInvalide(e.target.value.trim() !== '' && (n === null || n < 0))
              if (e.target.value.trim() === '') onChange(null)
              else if (n !== null && n >= 0) onChange(n)
            }}
            onFocus={() => (enSaisie.current = true)}
            onBlur={() => {
              enSaisie.current = false
              if (!invalide) setTexte(valeur === null ? '' : formatMontant(valeur))
            }}
          />
          <span className="saisie-unite">FCFA</span>
        </div>
      )}
    </Champ>
  )
}
