import { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FactureSaisie, LigneSaisie } from '../../shared/factures'
import * as F from './factures'
import { runMigrations } from './migrations'
import * as P from './parametres'

let db: DatabaseSync
let clientId: number

const conteneur: LigneSaisie = {
  num_conteneur: 'mscu 123456-7',
  type_conteneur: '20',
  zone: 'Dakar Zone 1',
  nature: 'import',
  designation: '',
  montant_ht: 70000,
  soumis_tva: true,
  quantite: 1, prestation_id: null
}
const debours = (designation: string, montant: number, prestation_id: number | null = null): LigneSaisie => ({
  num_conteneur: '',
  type_conteneur: null,
  zone: '',
  nature: null,
  designation,
  montant_ht: montant,
  soumis_tva: false,
  quantite: 1,
  prestation_id
})

function saisie(f: Partial<FactureSaisie> = {}): FactureSaisie {
  return {
    id: null,
    client_id: clientId,
    date: '2026-10-05',
    num_bl: ' BL 4521 ',
    notes: '',
    lignes: [conteneur, debours('AGS aller simple', 1500, 1), debours('Imprimé', 1000, 2)],
    ...f
  }
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  runMigrations(db)
  clientId = P.creerClient(db, {
    raison_sociale: 'SOCOCIM Industries',
    adresse: 'Rufisque',
    ninea: '0012345',
    tel: '33 839 88 00',
    email: ''
  }).id
})

describe('enregistrerBrouillon', () => {
  it('cas du cahier des charges : 72 500 / 12 600 / 85 100, sans numéro', () => {
    const f = F.enregistrerBrouillon(db, saisie())
    expect(f.statut).toBe('brouillon')
    expect(f.numero).toBeNull()
    expect([f.total_ht, f.base_tva, f.total_tva, f.total_ttc]).toEqual([72500, 70000, 12600, 85100])
    expect(f.taux_tva).toBe(18)
    expect(f.num_bl).toBe('BL 4521')
    expect(f.client_raison_sociale).toBe('SOCOCIM Industries')
    expect(f.lignes).toHaveLength(3)
    expect(f.lignes[0]).toMatchObject({
      num_conteneur: 'MSCU 123456-7',
      type_libelle: "20'",
      nature_libelle: 'Import',
      soumis_tva: true,
      ordre: 0
    })
  })

  it('met à jour un brouillon en remplaçant ses lignes', () => {
    const f = F.enregistrerBrouillon(db, saisie())
    const maj = F.enregistrerBrouillon(db, saisie({ id: f.id, lignes: [conteneur] }))
    expect(maj.id).toBe(f.id)
    expect(maj.lignes).toHaveLength(1)
    expect(maj.total_ttc).toBe(82600)
  })

  it('ignore les lignes vides', () => {
    const f = F.enregistrerBrouillon(db, saisie({ lignes: [conteneur, debours('', 0)] }))
    expect(f.lignes).toHaveLength(1)
  })

  it('refuse une saisie invalide avec des erreurs par champ', () => {
    try {
      F.enregistrerBrouillon(db, saisie({ client_id: null, lignes: [debours('', 5)] }))
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(P.ErreurValidation)
      expect(Object.keys((err as P.ErreurValidation).erreurs).sort()).toEqual(['client_id', 'ligne_0'])
    }
  })

  it('refuse un client désactivé pour une nouvelle facture', () => {
    db.exec(`UPDATE clients SET actif = 0 WHERE id = ${clientId}`)
    expect(() => F.enregistrerBrouillon(db, saisie())).toThrow(/désactivé/)
  })
})

describe('enregistrerEtValider', () => {
  it('attribue le numéro et fige la facture', () => {
    const f = F.enregistrerEtValider(db, saisie())
    expect(f.numero).toBe('2M-2026-0001')
    expect(f.statut).toBe('emise')
    expect(() => F.enregistrerBrouillon(db, saisie({ id: f.id }))).toThrow(/ne peut plus être modifiée/)
    expect(() => F.supprimerBrouillon(db, f.id)).toThrow(/avoir/)
  })

  it('les factures validées ne changent pas quand les Paramètres changent', () => {
    const f = F.enregistrerEtValider(db, saisie())
    P.modifierClient(db, clientId, {
      raison_sociale: 'SOCOCIM SA',
      adresse: 'Dakar',
      ninea: '',
      tel: '',
      email: ''
    })
    P.modifierEntreprise(db, { ...P.lireEntreprise(db), taux_tva: 10 })
    P.renommerElement(db, 'types_conteneurs', 1, '20 pieds')
    const relue = F.lireFacture(db, f.id)
    expect(relue.client_raison_sociale).toBe('SOCOCIM Industries')
    expect(relue.taux_tva).toBe(18)
    expect(relue.total_ttc).toBe(85100)
    expect(relue.lignes[0].type_libelle).toBe("20'")
  })

  it('exige des lignes complètes, sans rien numéroter en cas de refus', () => {
    expect(() => F.enregistrerEtValider(db, saisie({ lignes: [{ ...conteneur, zone: '' }] }))).toThrow(
      P.ErreurValidation
    )
    expect(F.enregistrerEtValider(db, saisie()).numero).toBe('2M-2026-0001')
  })

  it('valide un brouillon existant', () => {
    const b = F.enregistrerBrouillon(db, saisie())
    const f = F.enregistrerEtValider(db, saisie({ id: b.id }))
    expect(f.id).toBe(b.id)
    expect(f.numero).toBe('2M-2026-0001')
  })
})

describe('supprimerBrouillon et référentiels', () => {
  it('supprime un brouillon et ses lignes', () => {
    const b = F.enregistrerBrouillon(db, saisie())
    F.supprimerBrouillon(db, b.id)
    expect(() => F.lireFacture(db, b.id)).toThrow(/introuvable/)
    expect(db.prepare('SELECT COUNT(*) AS n FROM lignes').get()).toEqual({ n: 0 })
  })

  it('une prestation facturée est désactivée plutôt que supprimée', () => {
    F.enregistrerBrouillon(db, saisie())
    P.modifierPrestation(db, 1, { libelle: 'AGS (aller)', prix: 1500, soumis_tva: false, par_conteneur: false, automatique: false })
    expect(P.supprimerPrestation(db, 1)).toBe('desactive')
  })

  it('référentiels de saisie : uniquement les éléments actifs', () => {
    P.ajouterElement(db, 'natures', 'Transit')
    const t = P.listerListe(db, 'natures').find((n) => n.code === 'transit')!
    P.supprimerElement(db, 'natures', t.id)
    const r = F.referentiels(db)
    expect(r.natures.map((n) => n.code)).toEqual(['import', 'export'])
    expect(r.clients).toHaveLength(1)
    expect(r.taux_tva).toBe(18)
    expect(r.zones[0].zone).toBe('Dakar Zone 1')
  })
})

describe('factureProvisoire', () => {
  it('calcule l’aperçu sans rien enregistrer', () => {
    const f = F.factureProvisoire(db, saisie({ lignes: [conteneur, debours('AGS aller simple', 1500), debours('', 0)] }))
    expect([f.total_ht, f.total_tva, f.total_ttc]).toEqual([71500, 12600, 84100])
    expect(f.numero).toBeNull()
    expect(f.statut).toBe('brouillon')
    expect(f.lignes).toHaveLength(2)
    expect(f.lignes[0].type_libelle).toBe("20'")
    expect(f.client_raison_sociale).toBe('SOCOCIM Industries')
    expect(db.prepare('SELECT COUNT(*) AS n FROM factures').get()).toEqual({ n: 0 })
  })

  it('reprend le numéro d’une facture déjà validée', () => {
    const v = F.enregistrerEtValider(db, saisie())
    expect(F.factureProvisoire(db, saisie({ id: v.id })).numero).toBe('2M-2026-0001')
  })
})

describe('factureAAfficher', () => {
  it('une facture émise s’affiche avec ses valeurs figées, pas celles des Paramètres actuels', () => {
    const v = F.enregistrerEtValider(db, saisie())
    P.modifierEntreprise(db, { ...P.lireEntreprise(db), taux_tva: 10 })
    const f = F.factureAAfficher(db, saisie({ id: v.id }))
    expect([f.taux_tva, f.total_tva, f.numero]).toEqual([18, 12600, '2M-2026-0001'])
    expect(F.factureAAfficher(db, saisie()).taux_tva).toBe(10)
  })
})

describe('migration 4 : AGS par conteneur', () => {
  it('AGS aller simple est facturée par conteneur et ajoutée d’office', () => {
    const [agsP, imprime] = P.listerPrestations(db)
    expect([agsP.par_conteneur, agsP.automatique]).toEqual([true, true])
    expect([imprime.par_conteneur, imprime.automatique]).toEqual([false, false])
  })

  it('la quantité est enregistrée et recopiée dans l’avoir', () => {
    const f = F.enregistrerEtValider(
      db,
      saisie({ lignes: [conteneur, { ...conteneur, num_conteneur: 'B' }, { ...debours('AGS aller simple', 3000, 1), quantite: 2 }] })
    )
    expect(f.lignes[2].quantite).toBe(2)
    expect(f.total_ht).toBe(143000)
  })
})
