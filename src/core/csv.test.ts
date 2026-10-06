import { describe, expect, it } from 'vitest'
import type { TableauDeBord } from '../shared/tableau'
import { celluleCsv, dateCsv, nomFichierCsv, sectionsCsv, sectionsTableauDeBord, versCsv } from './csv'

describe('celluleCsv', () => {
  it('écrit les nombres en entiers bruts et les booléens en Oui / Non', () => {
    expect(celluleCsv(85100)).toBe('85100')
    expect(celluleCsv(true)).toBe('Oui')
    expect(celluleCsv(false)).toBe('Non')
    expect(celluleCsv(null)).toBe('')
  })

  it('met entre guillemets les textes contenant ; " ou un retour à la ligne', () => {
    expect(celluleCsv('SOCOCIM; Rufisque')).toBe('"SOCOCIM; Rufisque"')
    expect(celluleCsv('Conteneur 20"')).toBe('"Conteneur 20"""')
    expect(celluleCsv('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"')
  })

  it('neutralise les textes interprétables comme formule', () => {
    expect(celluleCsv('=SOMME(A1)')).toBe("'=SOMME(A1)")
    expect(celluleCsv('-50')).toBe("'-50")
  })
})

describe('versCsv / sectionsCsv', () => {
  it('commence par le BOM UTF-8, sépare par ; et termine les lignes par CRLF', () => {
    const csv = versCsv({ entetes: ['N°', 'Montant'], lignes: [['2M-2026-0001', 85100]] })
    expect(csv).toBe('﻿N°;Montant\r\n2M-2026-0001;85100\r\n')
  })

  it('sépare les sections par une ligne vide, titre en tête', () => {
    const csv = sectionsCsv([
      { titre: 'A', entetes: ['x'], lignes: [[1]] },
      { titre: 'B', entetes: ['y'], lignes: [] }
    ])
    expect(csv).toBe('﻿A\r\nx\r\n1\r\n\r\nB\r\ny\r\n')
  })
})

describe('dates et noms de fichier', () => {
  it('formate les dates en JJ/MM/AAAA', () => {
    expect(dateCsv('2026-10-06')).toBe('06/10/2026')
    expect(dateCsv('')).toBe('')
  })

  it('propose un nom avec la période', () => {
    expect(nomFichierCsv('Factures', '2026-10-06')).toBe('Factures_2026-10-06.csv')
    expect(nomFichierCsv('Factures', '2026-10-06', '2026-01-01', '2026-12-31')).toBe('Factures_2026-01-01_au_2026-12-31.csv')
    expect(nomFichierCsv('Factures', '2026-10-06', '2026-01-01')).toBe('Factures_2026-01-01_au_2026-10-06.csv')
  })
})

describe('sectionsTableauDeBord', () => {
  const t: TableauDeBord = {
    jour: '2026-10-06', du: '2026-01-01', au: '2026-12-31',
    mois: { ht: 72500, tva: 12600, ttc: 85100 },
    annee: { ht: 145000, tva: 25200, ttc: 170200 },
    periode: { ht: 145000, tva: 25200, ttc: 170200, nb_factures: 2, nb_conteneurs: 2 },
    impayes: { montant: 85100, nombre: 1, liste: [{ id: 1, numero: '2M-2026-0001', client: 'SOCOCIM', date: '2026-09-06', total_ttc: 85100, reste: 85100, jours: 30 }] },
    parMois: [{ mois: '2026-10', ht: 72500, tva: 12600, ttc: 85100 }],
    topClients: [{ client: 'SOCOCIM', ht: 145000, nb_factures: 2 }],
    conteneursParType: [{ libelle: "20'", nombre: 2 }],
    conteneursParZone: [{ zone: 'Dakar Zone 1', nombre: 2 }]
  }

  it('produit les six tableaux de la synthèse', () => {
    const s = sectionsTableauDeBord(t)
    expect(s.map((x) => x.titre)).toEqual([
      'Synthèse du 01/01/2026 au 31/12/2026', 'Chiffre d’affaires par mois', 'Meilleurs clients',
      'Conteneurs par type', 'Conteneurs par zone', 'Impayés au 06/10/2026'
    ])
    expect(s[0].lignes[0]).toEqual(['Période', 145000, 25200, 170200])
    expect(s[5].lignes[0]).toEqual(['2M-2026-0001', '06/09/2026', 'SOCOCIM', 85100, 85100, 30])
  })
})
