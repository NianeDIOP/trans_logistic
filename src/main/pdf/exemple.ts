import type { Facture } from '../../shared/factures'

/** Facture d'exemple pour l'aperçu des modèles quand aucune facture n'a encore été émise. */
export function factureExemple(taux: number): Facture {
  const ligne = {
    id: 1, ordre: 0, prestation_id: null, quantite: 1, num_conteneur: 'MSCU 123456-7', type_conteneur: '20',
    type_libelle: "20'", zone: 'Dakar Zone 1', nature: 'import', nature_libelle: 'Import', designation: '',
    montant_ht: 70000, soumis_tva: true
  }
  const conteneurs = [ligne, { ...ligne, id: 2, ordre: 1, num_conteneur: 'TGHU 765432-1', type_conteneur: '40', type_libelle: "40'", montant_ht: 110000 }]
  const frais = (id: number, designation: string, montant: number, quantite = 1) => ({
    ...ligne, id, ordre: id, num_conteneur: '', type_conteneur: null, type_libelle: '', zone: '', nature: null,
    nature_libelle: '', designation, montant_ht: montant, soumis_tva: false, quantite
  })
  const base = 180000
  const tva = Math.round((base * taux) / 100)
  return {
    id: 0, numero: '2M-2026-0001', type: 'facture', facture_origine_id: null, date: '2026-10-05', client_id: 0,
    num_bl: 'MEDU1234567', statut: 'emise', taux_tva: taux, total_ht: base + 4000, base_tva: base, total_tva: tva,
    total_ttc: base + 4000 + tva, notes: '', client_raison_sociale: 'Client exemple SA',
    client_adresse: 'Zone portuaire, Dakar', client_ninea: '0012345 2G3', client_tel: '33 800 00 00', client_email: '',
    pdf_path: null, cree_le: '', valide_le: '', origine: null, avoir: null, regle: 0,
    lignes: [...conteneurs, frais(3, 'AGS aller simple', 3000, 2), frais(4, 'Imprimé', 1000)]
  }
}
