import { PlusIcon, ShippingContainerIcon, TrashIcon } from '@phosphor-icons/react'
import type { LigneSaisie, Referentiels } from '@shared/factures'
import { appliquerPrestationsParConteneur, estLigneConteneur } from '../../../../core/facture'
import { formatMontant } from '../../../../core/montants'
import { SaisieMontant } from '../../components/ui/Champ'

export const LIGNE_CONTENEUR: LigneSaisie = {
  genre: 'conteneur',
  num_conteneur: '',
  type_conteneur: null,
  zone: '',
  nature: null,
  designation: '',
  montant_ht: 0,
  soumis_tva: true,
  quantite: 1,
  prestation_id: null
}

interface Props {
  lignes: LigneSaisie[]
  referentiels: Referentiels
  erreurs: Record<string, string>
  onChange: (lignes: LigneSaisie[]) => void
}

/** Prix de la grille pour une zone et un type, s'il existe. */
function prixGrille(ref: Referentiels, zone: string, type: string | null): number | undefined {
  if (!type) return undefined
  return ref.zones.find((z) => z.zone === zone)?.prix[type]
}

export default function TableauLignes({ lignes, referentiels, erreurs, onChange: transmettre }: Props): React.JSX.Element {
  // Toute modification recalcule les prestations facturées par conteneur (AGS…).
  const onChange = (suivantes: LigneSaisie[]): void =>
    transmettre(appliquerPrestationsParConteneur(suivantes, referentiels.prestations))
  const parConteneur = (l: LigneSaisie): boolean =>
    l.prestation_id !== null && Boolean(referentiels.prestations.find((p) => p.id === l.prestation_id)?.par_conteneur)
  const maj = (index: number, modif: Partial<LigneSaisie>): void => {
    const suivante = { ...lignes[index], ...modif }
    // Préremplissage : zone + type connus dans la grille → prix HT, soumis à TVA.
    if (('zone' in modif || 'type_conteneur' in modif) && estLigneConteneur(suivante)) {
      const prix = prixGrille(referentiels, suivante.zone, suivante.type_conteneur)
      if (prix !== undefined) {
        suivante.montant_ht = prix
        suivante.soumis_tva = true
      }
    }
    onChange(lignes.map((l, i) => (i === index ? suivante : l)))
  }

  const ajouterConteneur = (): void => {
    // Le nouveau conteneur reprend type, zone et nature du précédent (cas fréquent d'un même BL).
    const precedent = [...lignes].reverse().find((l) => estLigneConteneur(l))
    const nouvelle: LigneSaisie = precedent
      ? { ...LIGNE_CONTENEUR, type_conteneur: precedent.type_conteneur, zone: precedent.zone, nature: precedent.nature, montant_ht: precedent.montant_ht }
      : { ...LIGNE_CONTENEUR, nature: referentiels.natures[0]?.code ?? null }
    // Les conteneurs restent groupés avant les frais.
    const position = lignes.findIndex((l) => !estLigneConteneur(l))
    const copie = [...lignes]
    copie.splice(position === -1 ? copie.length : position, 0, nouvelle)
    onChange(copie)
    requestAnimationFrame(() => {
      const champs = document.querySelectorAll<HTMLInputElement>('.lignes-saisie .champ-tc')
      champs[position === -1 ? champs.length - 1 : position]?.focus()
    })
  }

  const ajouterPrestation = (id: number): void => {
    const p = referentiels.prestations.find((x) => x.id === id)
    if (!p) return
    // Une prestation par conteneur couvre déjà tous les conteneurs : pas de doublon.
    if (p.par_conteneur && lignes.some((l) => l.prestation_id === p.id)) return
    onChange([
      ...lignes,
      {
        ...LIGNE_CONTENEUR,
        genre: 'frais',
        type_conteneur: null,
        designation: p.libelle,
        montant_ht: p.par_conteneur ? 0 : p.prix,
        soumis_tva: p.soumis_tva,
        quantite: p.par_conteneur ? 0 : 1,
        prestation_id: p.id
      }
    ])
  }

  const ajouterLibre = (): void => {
    onChange([...lignes, { ...LIGNE_CONTENEUR, genre: 'frais', type_conteneur: null, soumis_tva: true, quantite: 1 }])
    requestAnimationFrame(() => {
      const champs = document.querySelectorAll<HTMLInputElement>('.lignes-saisie .champ-designation')
      champs[champs.length - 1]?.focus()
    })
  }

  const supprimer = (index: number): void => onChange(lignes.filter((_, i) => i !== index))

  return (
    <div className="lignes-bloc">
      <table className="tableau lignes-saisie">
        <thead>
          <tr>
            <th style={{ width: '19%' }}>N° conteneur</th>
            <th style={{ width: '11%' }}>Type</th>
            <th>Zone de livraison</th>
            <th style={{ width: '12%' }}>Nature</th>
            <th className="col-montant" style={{ width: '17%' }}>
              Montant HT
            </th>
            <th className="col-tva">TVA</th>
            <th className="col-actions" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const erreur = erreurs[`ligne_${i}`]
            const estConteneur = estLigneConteneur(l)
            const tarifManquant =
              estConteneur && l.zone && l.type_conteneur && prixGrille(referentiels, l.zone, l.type_conteneur) === undefined
            return (
              <tr key={i} className={erreur ? 'ligne-erreur' : ''}>
                {estConteneur ? (
                  <>
                    <td>
                      <input
                        className="saisie saisie-compacte champ-tc"
                        placeholder="ex. MSCU 123456-7"
                        value={l.num_conteneur}
                        onChange={(e) => maj(i, { num_conteneur: e.target.value.toUpperCase() })}
                        aria-label={`N° conteneur, ligne ${i + 1}`}
                      />
                    </td>
                    <td>
                      <select
                        className="saisie saisie-compacte"
                        value={l.type_conteneur ?? ''}
                        onChange={(e) => maj(i, { type_conteneur: e.target.value || null })}
                        aria-label={`Type, ligne ${i + 1}`}
                      >
                        <option value="">—</option>
                        {referentiels.types.map((t) => (
                          <option key={t.code} value={t.code}>
                            {t.libelle}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="saisie saisie-compacte"
                        value={l.zone}
                        onChange={(e) => maj(i, { zone: e.target.value })}
                        aria-label={`Zone, ligne ${i + 1}`}
                      >
                        <option value="">Choisir une zone…</option>
                        {referentiels.zones.map((z) => {
                          const prix = l.type_conteneur ? z.prix[l.type_conteneur] : undefined
                          return (
                            <option key={z.zone} value={z.zone}>
                              {z.zone}
                              {prix !== undefined ? ` — ${formatMontant(prix)}` : ''}
                            </option>
                          )
                        })}
                        {l.zone && !referentiels.zones.some((z) => z.zone === l.zone) && (
                          <option value={l.zone}>{l.zone}</option>
                        )}
                      </select>
                      {tarifManquant && <span className="ligne-aide">Pas de tarif pour ce type : montant à saisir.</span>}
                    </td>
                    <td>
                      <select
                        className="saisie saisie-compacte"
                        value={l.nature ?? ''}
                        onChange={(e) => maj(i, { nature: e.target.value || null })}
                        aria-label={`Nature, ligne ${i + 1}`}
                      >
                        <option value="">—</option>
                        {referentiels.natures.map((n) => (
                          <option key={n.code} value={n.code}>
                            {n.libelle}
                          </option>
                        ))}
                      </select>
                    </td>
                  </>
                ) : (
                  <td colSpan={4}>
                    <div className="ligne-prestation">
                      <span className={`badge ${l.soumis_tva ? 'badge-tva' : 'badge-hors-tva'}`}>
                        {l.prestation_id !== null ? (l.soumis_tva ? 'Prestation' : 'Débours') : 'Autre'}
                      </span>
                      <input
                        className="saisie saisie-compacte champ-designation"
                        placeholder="Désignation"
                        value={l.designation}
                        onChange={(e) => maj(i, { designation: e.target.value })}
                        aria-label={`Désignation, ligne ${i + 1}`}
                      />
                      {parConteneur(l) && (
                        <span className="ligne-quantite" title="Calculé automatiquement : un montant par conteneur">
                          × {l.quantite} conteneur{l.quantite > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                )}
                <td>
                  {parConteneur(l) ? (
                    <div className="montant-calcule" title={`${l.quantite} × ${formatMontant(l.quantite ? l.montant_ht / l.quantite : 0)}`}>
                      {formatMontant(l.montant_ht)} <span>FCFA</span>
                    </div>
                  ) : (
                  <SaisieMontant
                    valeur={l.montant_ht}
                    onChange={(v) => maj(i, { montant_ht: v ?? 0 })}
                    className="saisie-compacte"
                    aria-label={`Montant HT, ligne ${i + 1}`}
                  />
                  )}
                </td>
                <td className="col-tva">
                  <input
                    type="checkbox"
                    className="case"
                    checked={l.soumis_tva}
                    onChange={(e) => maj(i, { soumis_tva: e.target.checked })}
                    aria-label={`Soumis à TVA, ligne ${i + 1}`}
                    title={l.soumis_tva ? 'Soumis à TVA' : 'Hors TVA'}
                  />
                </td>
                <td className="col-actions">
                  <button type="button" className="btn-icone btn-icone-danger" title="Retirer la ligne" onClick={() => supprimer(i)}>
                    <TrashIcon size={17} />
                  </button>
                </td>
              </tr>
            )
          })}
          {lignes.length === 0 && (
            <tr>
              <td colSpan={7} className="lignes-vide">
                Ajoutez un conteneur ou une prestation.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {Object.entries(erreurs)
        .filter(([cle]) => cle.startsWith('ligne_'))
        .map(([cle, message]) => (
          <p key={cle} className="champ-message">
            Ligne {Number(cle.slice(6)) + 1} : {message}
          </p>
        ))}
      {erreurs.lignes && <p className="champ-message">{erreurs.lignes}</p>}

      <div className="lignes-ajout">
        <button type="button" className="btn btn-secondaire" onClick={ajouterConteneur}>
          <ShippingContainerIcon size={18} weight="duotone" />
          Ajouter un conteneur
        </button>
        <span className="lignes-ajout-sep" />
        {referentiels.prestations.map((p) => (
          <button
            key={p.id}
            type="button"
            className="puce"
            onClick={() => ajouterPrestation(p.id)}
            disabled={p.par_conteneur && lignes.some((l) => l.prestation_id === p.id)}
            title={`${p.soumis_tva ? 'Soumis à TVA' : 'Hors TVA'}${p.par_conteneur ? ' · par conteneur' : ''}`}
          >
            <PlusIcon size={13} weight="bold" />
            {p.libelle}
            <span className="puce-prix">
              {formatMontant(p.prix)}
              {p.par_conteneur ? ' / TC' : ''}
            </span>
          </button>
        ))}
        <button type="button" className="puce puce-discrete" onClick={ajouterLibre}>
          <PlusIcon size={13} weight="bold" />
          Autre ligne
        </button>
      </div>
    </div>
  )
}
