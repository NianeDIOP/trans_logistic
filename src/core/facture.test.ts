import { describe, expect, it } from 'vitest'
import type { FactureSaisie, LigneSaisie } from '../shared/factures'
import {
  appliquerPrestationsParConteneur,
  aujourdhui,
  dateValide,
  formatDate,
  lignesAutomatiques,
  ligneVide,
  nomFichierFacture,
  nombreConteneurs,
  verifierFacture
} from './facture'
import type { Prestation } from '../shared/parametres'

const conteneur: LigneSaisie = {
  num_conteneur: 'MSCU 123456-7',
  type_conteneur: '20',
  zone: 'Dakar Zone 1',
  nature: 'import',
  designation: '',
  montant_ht: 70000,
  soumis_tva: true,
  quantite: 1, prestation_id: null
}
const ags: LigneSaisie = {
  num_conteneur: '',
  type_conteneur: null,
  zone: '',
  nature: null,
  designation: 'AGS aller simple',
  montant_ht: 1500,
  soumis_tva: false,
  quantite: 1, prestation_id: 1
}
const vide: LigneSaisie = { ...ags, designation: '', montant_ht: 0, prestation_id: null }
const facture = (f: Partial<FactureSaisie> = {}): FactureSaisie => ({
  id: null,
  client_id: 1,
  date: '2026-10-05',
  num_bl: 'BL-001',
  notes: '',
  lignes: [conteneur, ags],
  ...f
})

describe('verifierFacture', () => {
  it('accepte une facture complète', () => {
    expect(verifierFacture(facture(), true)).toBeNull()
  })

  it('exige un client et une date valide', () => {
    const e = verifierFacture(facture({ client_id: null, date: '2026-02-30' }), false)
    expect(e?.client_id).toBeDefined()
    expect(e?.date).toBeDefined()
  })

  it('ignore les lignes vides, mais exige une ligne pour valider', () => {
    expect(verifierFacture(facture({ lignes: [conteneur, vide] }), true)).toBeNull()
    expect(verifierFacture(facture({ lignes: [vide] }), false)).toBeNull()
    expect(verifierFacture(facture({ lignes: [vide] }), true)?.lignes).toBeDefined()
  })

  it('un brouillon accepte une ligne de conteneur incomplète, pas la validation', () => {
    const incomplete = { ...conteneur, zone: '' }
    expect(verifierFacture(facture({ lignes: [incomplete] }), false)).toBeNull()
    expect(verifierFacture(facture({ lignes: [incomplete] }), true)?.parLigne[0]).toMatch(/zone/)
  })

  it('refuse un montant décimal ou négatif, et un montant nul à la validation', () => {
    expect(verifierFacture(facture({ lignes: [{ ...ags, montant_ht: 1.5 }] }), false)?.parLigne[0]).toBeDefined()
    expect(verifierFacture(facture({ lignes: [{ ...ags, montant_ht: -1 }] }), false)?.parLigne[0]).toBeDefined()
    expect(verifierFacture(facture({ lignes: [{ ...conteneur, montant_ht: 0 }] }), true)?.parLigne[0]).toMatch(/zéro/)
  })

  it('une prestation exige une désignation', () => {
    expect(verifierFacture(facture({ lignes: [{ ...ags, designation: ' ' }] }), false)?.parLigne[0]).toMatch(
      /désignation/
    )
  })
})

describe('utilitaires', () => {
  it('ligneVide', () => {
    expect(ligneVide(vide)).toBe(true)
    expect(ligneVide(ags)).toBe(false)
  })

  it('dates', () => {
    expect(dateValide('2026-10-05')).toBe(true)
    expect(dateValide('2026-13-01')).toBe(false)
    expect(dateValide('05/10/2026')).toBe(false)
    expect(formatDate('2026-10-05')).toBe('05/10/2026')
    expect(aujourdhui(new Date(2026, 0, 7))).toBe('2026-01-07')
  })

  it('nomFichierFacture', () => {
    expect(nomFichierFacture('2M-2026-0001', 'SOCOCIM Industries')).toBe('Facture_2M-2026-0001_SOCOCIM_Industries.pdf')
    expect(nomFichierFacture('2M-2026-0002', 'A/B: "C" <D>?')).toBe('Facture_2M-2026-0002_AB_C_D.pdf')
    expect(nomFichierFacture('AV-2M-2026-0001', 'X', 'avoir')).toBe('Avoir_AV-2M-2026-0001_X.pdf')
    expect(nomFichierFacture('2M-2026-0003', '   ')).toBe('Facture_2M-2026-0003_Client.pdf')
  })
})

describe('genre de ligne', () => {
  it('une ligne marquée conteneur sans zone exige zone et type à la validation', () => {
    const l = { ...vide, genre: 'conteneur' as const, num_conteneur: 'TGHU 1', montant_ht: 70000 }
    expect(verifierFacture(facture({ lignes: [l] }), true)?.parLigne[0]).toMatch(/zone/)
  })

  it('une ligne de conteneur avec seulement la nature préremplie est vide', () => {
    expect(ligneVide({ ...vide, genre: 'conteneur', nature: 'import' })).toBe(true)
  })
})

describe('AGS aller simple : 1 500 par conteneur', () => {
  const catalogue: Prestation[] = [
    { id: 1, libelle: 'AGS aller simple', prix: 1500, soumis_tva: false, par_conteneur: true, automatique: true, actif: true, ordre: 1 },
    { id: 2, libelle: 'Imprimé', prix: 1000, soumis_tva: false, par_conteneur: false, automatique: false, actif: true, ordre: 2 }
  ]
  const agsLigne = { ...ags, quantite: 0, montant_ht: 0 }
  const imprime = { ...ags, designation: 'Imprimé', montant_ht: 1000, prestation_id: 2 }

  it('quantité = nombre de conteneurs, montant = quantité × 1 500', () => {
    const lignes = [conteneur, { ...conteneur, num_conteneur: 'TGHU 2', type_conteneur: '40' }, agsLigne, imprime]
    const r = appliquerPrestationsParConteneur(lignes, catalogue)
    expect(r[2]).toMatchObject({ quantite: 2, montant_ht: 3000 })
    expect(r[3]).toBe(imprime)
  })

  it('cas obligatoire : 1 conteneur → AGS 1 500', () => {
    const r = appliquerPrestationsParConteneur([conteneur, agsLigne, imprime], catalogue)
    expect(r[1].montant_ht).toBe(1500)
  })

  it('les lignes de conteneur vides ne comptent pas ; rien ne change si déjà à jour', () => {
    const lignes = [conteneur, { ...vide, genre: 'conteneur' as const }]
    expect(nombreConteneurs(lignes)).toBe(1)
    const ajour = [conteneur, { ...agsLigne, quantite: 1, montant_ht: 1500 }]
    expect(appliquerPrestationsParConteneur(ajour, catalogue)).toBe(ajour)
  })

  it('prestation retirée du catalogue : garde le prix unitaire déjà appliqué', () => {
    const r = appliquerPrestationsParConteneur(
      [conteneur, conteneur, conteneur, { ...agsLigne, quantite: 2, montant_ht: 3000 }],
      []
    )
    expect(r[3]).toMatchObject({ quantite: 3, montant_ht: 4500 })
  })

  it('lignes ajoutées d’office à une nouvelle facture', () => {
    expect(lignesAutomatiques(catalogue)).toEqual([
      expect.objectContaining({ designation: 'AGS aller simple', prestation_id: 1, soumis_tva: false, quantite: 0 })
    ])
  })
})
