import type { ClientSaisie } from '@shared/parametres'
import { ChampTexte } from './ui/Champ'

interface Props {
  saisie: ClientSaisie
  onChange: (saisie: ClientSaisie) => void
  erreurs: Record<string, string>
}

/** Champs d'un client (Paramètres et création rapide depuis la facture). */
export default function FormulaireClient({ saisie, onChange, erreurs }: Props): React.JSX.Element {
  const maj = (champ: keyof ClientSaisie) => (v: string) => onChange({ ...saisie, [champ]: v })
  return (
    <div className="grille-champs">
      <ChampTexte className="pleine-largeur" libelle="Raison sociale" obligatoire valeur={saisie.raison_sociale} onChange={maj('raison_sociale')} erreur={erreurs.raison_sociale} />
      <ChampTexte className="pleine-largeur" libelle="Adresse" valeur={saisie.adresse} onChange={maj('adresse')} />
      <ChampTexte libelle="NINEA" valeur={saisie.ninea} onChange={maj('ninea')} />
      <ChampTexte libelle="Téléphone" valeur={saisie.tel} onChange={maj('tel')} />
      <ChampTexte className="pleine-largeur" libelle="Email" type="email" valeur={saisie.email} onChange={maj('email')} erreur={erreurs.email} />
    </div>
  )
}
