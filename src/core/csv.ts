/**
 * Export CSV lisible directement par Excel (version française) :
 * séparateur « ; », fins de ligne CRLF, UTF-8 avec BOM (accents corrects à l'ouverture).
 * Les montants sont écrits en entiers bruts (sans espace) pour rester des nombres dans le tableur.
 */
import type { TableauDeBord } from '../shared/tableau'
import { libelleMois } from './periodes'

export type CelluleCsv = string | number | boolean | null | undefined

export interface TableCsv {
  entetes: string[]
  lignes: CelluleCsv[][]
}

export interface SectionCsv extends TableCsv {
  titre: string
}

const SEPARATEUR = ';'
const FIN = '\r\n'
const BOM = '﻿'

/** Une cellule : guillemets si nécessaire ; texte commençant par =, +, - ou @ neutralisé (formule). */
export function celluleCsv(v: CelluleCsv): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  let t = v
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return /[";\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

function ligneCsv(cellules: CelluleCsv[]): string {
  return cellules.map(celluleCsv).join(SEPARATEUR)
}

/** Tableau simple : une ligne d'en-têtes puis les données. */
export function versCsv(table: TableCsv): string {
  return BOM + [table.entetes, ...table.lignes].map(ligneCsv).join(FIN) + FIN
}

/** Plusieurs tableaux dans un même fichier, chacun précédé de son titre et séparé par une ligne vide. */
export function sectionsCsv(sections: SectionCsv[]): string {
  const blocs = sections.map((s) => [ligneCsv([s.titre]), ligneCsv(s.entetes), ...s.lignes.map(ligneCsv)].join(FIN))
  return BOM + blocs.join(FIN + FIN) + FIN
}

/** AAAA-MM-JJ → JJ/MM/AAAA (format de date reconnu par Excel en français). */
export function dateCsv(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

/** Nom de fichier proposé : `Factures_2026-01-01_au_2026-10-06.csv`, ou `Factures_2026-10-06.csv`. */
export function nomFichierCsv(prefixe: string, jour: string, du?: string, au?: string): string {
  if (du || au) return `${prefixe}_${du ?? 'debut'}_au_${au ?? jour}.csv`
  return `${prefixe}_${jour}.csv`
}

/** Synthèse du tableau de bord : indicateurs, mois, clients, conteneurs, impayés. */
export function sectionsTableauDeBord(t: TableauDeBord): SectionCsv[] {
  return [
    {
      titre: `Synthèse du ${dateCsv(t.du)} au ${dateCsv(t.au)}`,
      entetes: ['Indicateur', 'HT (FCFA)', 'TVA (FCFA)', 'TTC (FCFA)'],
      lignes: [
        ['Période', t.periode.ht, t.periode.tva, t.periode.ttc],
        [`Mois en cours`, t.mois.ht, t.mois.tva, t.mois.ttc],
        [`Année ${t.jour.slice(0, 4)}`, t.annee.ht, t.annee.tva, t.annee.ttc],
        ['Factures émises (période)', t.periode.nb_factures, null, null],
        ['Conteneurs (période)', t.periode.nb_conteneurs, null, null],
        [`Impayés au ${dateCsv(t.jour)}`, null, null, t.impayes.montant]
      ]
    },
    {
      titre: 'Chiffre d’affaires par mois',
      entetes: ['Mois', 'HT (FCFA)', 'TVA (FCFA)', 'TTC (FCFA)'],
      lignes: t.parMois.map((m) => [libelleMois(m.mois, true), m.ht, m.tva, m.ttc])
    },
    {
      titre: 'Meilleurs clients',
      entetes: ['Client', 'CA HT (FCFA)', 'Factures'],
      lignes: t.topClients.map((c) => [c.client, c.ht, c.nb_factures])
    },
    {
      titre: 'Conteneurs par type',
      entetes: ['Type', 'Conteneurs'],
      lignes: t.conteneursParType.map((c) => [c.libelle, c.nombre])
    },
    {
      titre: 'Conteneurs par zone',
      entetes: ['Zone', 'Conteneurs'],
      lignes: t.conteneursParZone.map((c) => [c.zone, c.nombre])
    },
    {
      titre: `Impayés au ${dateCsv(t.jour)}`,
      ...tableImpayes(t)
    }
  ]
}

/** Liste des impayés à ce jour. */
export function tableImpayes(t: TableauDeBord): TableCsv {
  return {
    entetes: ['N° facture', 'Date', 'Client', 'Total TTC (FCFA)', 'Reste à payer (FCFA)', 'Ancienneté (jours)'],
    lignes: t.impayes.liste.map((i) => [i.numero, dateCsv(i.date), i.client, i.total_ttc, i.reste, i.jours])
  }
}
