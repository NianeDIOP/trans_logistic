import { describe, expect, it } from 'vitest'
import type { Facture } from '../../shared/factures'
import type { Entreprise } from '../../shared/types'
import { modeleFacture, teinte } from './modele'

const entreprise: Entreprise = {
  id: 1,
  raison_sociale: '2M LOGISTIQUE ET TRANSPORT',
  rc: 'SNLGA 2021-B991',
  ninea: '008740947 2H2',
  banque: 'BICIS Louga',
  iban: 'SN10 07534 007766000006 09',
  siege: 'Dakar',
  adresse: 'Quartier Thiokhna, Louga',
  email: '2mlogistiquetransport25@gmail.com',
  tel: '(+221) 77 533 65 33',
  logo_path: null,
  cachet_path: null,
  taux_tva: 18,
  prefixe_facture: '2M',
  mentions: 'Paiement à réception.\nMerci.',
  modele_facture: 'classique',
  theme_facture: 'marque'
}

const ligne = {
  id: 1, ordre: 0, prestation_id: null, num_conteneur: 'MSCU 1234567', type_conteneur: '20',
  type_libelle: "20'", zone: 'Dakar Zone 1', nature: 'import', nature_libelle: 'Import',
  designation: '', montant_ht: 70000, soumis_tva: true, quantite: 1
}

const facture: Facture = {
  id: 1, numero: '2M-2026-0001', type: 'facture', facture_origine_id: null, date: '2026-10-05',
  client_id: 1, num_bl: 'BL 4521', statut: 'emise', taux_tva: 18,
  total_ht: 72500, base_tva: 70000, total_tva: 12600, total_ttc: 85100, notes: '',
  client_raison_sociale: 'Client <Test> & Cie', client_adresse: 'Rufisque', client_ninea: '0012345',
  client_tel: '', client_email: '', pdf_path: null, cree_le: '', valide_le: '2026-10-05T10:00:00Z',
  origine: null, avoir: null, regle: 0,
  lignes: [
    ligne,
    { ...ligne, id: 2, ordre: 1, num_conteneur: '', type_conteneur: null, type_libelle: '', zone: '',
      nature: null, nature_libelle: '', designation: 'AGS aller simple', montant_ht: 1500, soumis_tva: false }
  ]
}

const ressources = { policesCss: '', logo: 'data:image/png;base64,AAA', cachet: null }
const sansEspaces = (html: string): string => html.replace(/&nbsp;/g, ' ')

describe('modeleFacture', () => {
  const doc = modeleFacture(facture, entreprise, ressources)
  const html = sansEspaces(doc.html + doc.pied)

  it('affiche le numéro, la date, le client et le N° BL', () => {
    expect(html).toContain('2M-2026-0001')
    expect(html).toContain('05/10/2026')
    expect(html).toContain('BL 4521')
  })

  it('échappe le HTML des données saisies', () => {
    expect(html).toContain('Client &lt;Test&gt; &amp; Cie')
    expect(html).not.toContain('<Test>')
  })

  it('affiche les totaux du cas obligatoire et le montant en lettres', () => {
    for (const m of ['72 500', '70 000', '12 600', '85 100 FCFA']) expect(html).toContain(m)
    expect(html).toContain('Quatre-vingt-cinq mille cent francs CFA')
  })

  it('reprend les informations de l’entreprise depuis les Paramètres', () => {
    for (const v of ['SNLGA 2021-B991', '008740947 2H2', 'BICIS Louga', 'SN10 07534 007766000006 09']) {
      expect(html).toContain(v)
    }
    expect(html).toContain('Paiement à réception.<br>Merci.')
    expect(doc.pied).toContain('class="pageNumber"')
  })

  it('distingue lignes de conteneur et débours', () => {
    expect(html).toContain('MSCU 1234567')
    expect(html).toContain('colspan="4" class="designation">AGS aller simple <span class="mention-tva">hors TVA')
  })

  it('marque les brouillons', () => {
    const b = modeleFacture({ ...facture, statut: 'brouillon', numero: null }, entreprise, ressources).html
    expect(b).toContain('BROUILLON')
    expect(b).toContain('en attente de validation')
    expect(html).not.toContain('class="filigrane"')
  })
})

describe('modes de rendu', () => {
  it('le pied de page est dans la page pour l’aperçu et l’impression, pas pour le PDF', () => {
    expect(modeleFacture(facture, entreprise, ressources, 'pdf').html).not.toContain('<footer class="pied-flux">')
    expect(modeleFacture(facture, entreprise, ressources, 'impression').html).toContain('<footer class="pied-flux">')
    const ecran = modeleFacture(facture, entreprise, ressources, 'ecran').html
    expect(ecran).toContain('<footer class="pied-flux">')
    expect(ecran).toContain('width: 210mm')
  })
})

describe('avoir', () => {
  it('référence la facture annulée et son motif', () => {
    const avoir = { ...facture, type: 'avoir' as const, numero: 'AV-2M-2026-0001', notes: 'Erreur de zone',
      origine: { id: 1, numero: '2M-2026-0001', date: '2026-10-05' } }
    const html = modeleFacture(avoir, entreprise, ressources).html
    expect(html).toContain('<h1>Avoir</h1>')
    expect(html).toContain('Annule la facture N° <strong>2M-2026-0001</strong> du 05/10/2026')
    expect(html).toContain('Motif : Erreur de zone')
    expect(html).toContain('Montant de l’avoir')
    expect(html).toContain('Arrêté le présent avoir')
  })
})

describe('prestation par conteneur', () => {
  it('affiche le détail « N conteneurs × prix »', () => {
    const f = { ...facture, lignes: [facture.lignes[0], { ...facture.lignes[1], quantite: 3, montant_ht: 4500 }] }
    const html = modeleFacture(f, entreprise, ressources).html.replace(/&nbsp;/g, ' ')
    expect(html).toContain('AGS aller simple <span class="quantite">— 3 conteneurs × 1 500</span>')
  })
})

describe('détail des totaux', () => {
  it('la TVA porte sur les conteneurs, les débours sont à part', () => {
    const html = modeleFacture({ ...facture, lignes: [...facture.lignes, { ...facture.lignes[1], id: 3, designation: 'Imprimé', montant_ht: 1000 }] }, entreprise, ressources).html.replace(/&nbsp;/g, ' ')
    expect(html).toContain('<td>Transport HT (conteneurs)</td><td class="num">70 000</td>')
    expect(html).toContain('<td>TVA 18 % sur conteneurs</td><td class="num">12 600</td>')
    expect(html).toContain('<td>Débours hors TVA</td><td class="num">2 500</td>')
    expect(html).toContain('85 100 FCFA')
  })
})

describe('modèles et thèmes', () => {
  it('applique la mise en page et le thème de l’entreprise', () => {
    const html = modeleFacture(facture, { ...entreprise, modele_facture: 'bandeau', theme_facture: 'emeraude' }, ressources).html
    expect(html).toContain('<body class="modele-bandeau">')
    expect(html).toContain('--p: #0f5d4a')
  })

  it('un aperçu peut imposer modèle et thème ; une valeur inconnue revient au défaut', () => {
    const html = modeleFacture(facture, entreprise, ressources, 'ecran', { modele: 'epure', theme: 'noir_blanc' }).html
    expect(html).toContain('<body class="modele-epure">')
    expect(html).toContain('--p: #111111')
    const defaut = modeleFacture(facture, { ...entreprise, modele_facture: 'inconnu', theme_facture: '?' }, ressources).html
    expect(defaut).toContain('<body class="modele-classique">')
    expect(defaut).toContain('--p: #0b2569')
  })

  it('les cinq mises en page produisent un document complet', () => {
    for (const m of ['classique', 'bandeau', 'epure', 'moderne', 'compact']) {
      const html = modeleFacture(facture, entreprise, ressources, 'pdf', { modele: m }).html.replace(/&nbsp;/g, ' ')
      expect(html).toContain('85 100 FCFA')
      expect(html).toContain('Quatre-vingt-cinq mille cent francs CFA')
    }
  })
})

describe('teinte', () => {
  it('mélange avec le blanc', () => {
    expect(teinte('#000000', 0.5)).toBe('#808080')
    expect(teinte('#0b2569', 0)).toBe('#0b2569')
    expect(teinte('#0b2569', 1)).toBe('#ffffff')
  })
})
