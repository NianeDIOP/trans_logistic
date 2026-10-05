/**
 * Modèle HTML de la facture (A4), rendu en PDF par Chromium (`printToPDF`).
 * Fonction pure : toutes les ressources (polices, logo, cachet) sont fournies en data URL.
 */
import { formatDate } from '../../core/facture'
import { montantEnLettres } from '../../core/lettres'
import { formatMontant } from '../../core/montants'
import type { Entreprise } from '../../shared/types'
import type { Facture } from '../../shared/factures'

export interface RessourcesPdf {
  /** Règles @font-face (polices embarquées). */
  policesCss: string
  logo: string
  cachet: string | null
}

const echapper = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Texte échappé, retours à la ligne conservés. */
const texte = (s: string): string => echapper(s).replace(/\n/g, '<br>')

const montant = (n: number): string => formatMontant(n).replace(/ /g, '&nbsp;')

export interface DocumentPdf {
  html: string
  /** Pied de page répété sur chaque page (gabarit `footerTemplate` de Chromium). */
  pied: string
}

/**
 * - `pdf` : pied de page fourni à part (répété par Chromium sur chaque page) ;
 * - `impression` : pied de page en fin de document (impression directe) ;
 * - `ecran` : aperçu dans l'application, page A4 dessinée à l'écran.
 */
export type ModeRendu = 'pdf' | 'impression' | 'ecran'

export function modeleFacture(
  facture: Facture,
  entreprise: Entreprise,
  ressources: RessourcesPdf,
  mode: ModeRendu = 'pdf'
): DocumentPdf {
  const brouillon = facture.statut === 'brouillon'
  const titre = facture.type === 'avoir' ? 'Avoir' : 'Facture'
  const numero = facture.numero ?? 'en attente de validation'

  const lignes = facture.lignes
    .map((l) => {
      const estConteneur = l.zone !== '' || l.type_conteneur !== null
      const cellules = estConteneur
        ? `<td class="mono">${echapper(l.num_conteneur) || '—'}</td>
           <td>${echapper(l.type_libelle) || '—'}</td>
           <td>${echapper(l.zone) || '—'}${l.designation ? `<div class="precision">${echapper(l.designation)}</div>` : ''}</td>
           <td>${echapper(l.nature_libelle) || '—'}</td>`
        : `<td colspan="4" class="designation">${echapper(l.designation)}${
            l.quantite > 1
              ? ` <span class="quantite">— ${l.quantite} conteneurs × ${montant(Math.round(l.montant_ht / l.quantite))}</span>`
              : ''
          }${
            l.soumis_tva ? '' : ' <span class="mention-tva">hors TVA</span>'
          }</td>`
      return `<tr>${cellules}<td class="num">${montant(l.montant_ht)}</td></tr>`
    })
    .join('')

  const coordonneesClient = [
    facture.client_adresse && `<p>${texte(facture.client_adresse)}</p>`,
    facture.client_ninea && `<p><span class="etiquette">NINEA</span> ${echapper(facture.client_ninea)}</p>`,
    facture.client_tel && `<p><span class="etiquette">Tél.</span> ${echapper(facture.client_tel)}</p>`,
    facture.num_bl && `<p class="bl"><span class="etiquette">N° BL</span> ${echapper(facture.num_bl)}</p>`
  ]
    .filter(Boolean)
    .join('')

  const piedEntreprise = [
    echapper(entreprise.raison_sociale),
    entreprise.rc && `RC : ${echapper(entreprise.rc)}`,
    entreprise.ninea && `NINEA : ${echapper(entreprise.ninea)}`
  ]
    .filter(Boolean)
    .join(' · ')
  const piedBanque = [entreprise.banque && echapper(entreprise.banque), entreprise.iban && `N° ${echapper(entreprise.iban)}`]
    .filter(Boolean)
    .join(' — ')
  const piedContacts = [
    entreprise.adresse && echapper(entreprise.adresse),
    entreprise.siege && `Siège opérationnel : ${echapper(entreprise.siege)}`,
    entreprise.tel && echapper(entreprise.tel),
    entreprise.email && echapper(entreprise.email)
  ]
    .filter(Boolean)
    .join(' · ')

  const contenuPied = `
    <div style="font-weight:700;color:#0b2569">${piedEntreprise}</div>
    ${piedBanque ? `<div>Banque : ${piedBanque}</div>` : ''}
    <div>${piedContacts}</div>`
  const pied = `<div style="width:100%;margin:0 14mm;padding-top:2mm;border-top:0.5mm solid #f2b51d;
    font-family:'Segoe UI',Arial,sans-serif;font-size:7pt;line-height:1.45;color:#48557a;text-align:center;
    -webkit-print-color-adjust:exact">${contenuPied}
    <div style="margin-top:1mm;color:#8590aa">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>
  </div>`

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${titre} ${echapper(numero)}</title>
<style>
${ressources.policesCss}
@page { size: A4; margin: 14mm 14mm 24mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Source Sans 3', sans-serif; font-size: 10pt; line-height: 1.4; color: #0e1a36; }
.titre-police { font-family: 'Montserrat', sans-serif; }

/* En-tête */
.entete { display: flex; justify-content: space-between; align-items: center; gap: 10mm; padding-bottom: 5mm; }
.entete img { height: 27mm; }
.societe { text-align: right; font-size: 9pt; color: #48557a; }
.societe .nom { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 12.5pt; color: #0b2569; letter-spacing: .02em; margin-bottom: 1.5mm; }
.filet-or { height: 1.2mm; border-radius: 1mm; background: linear-gradient(90deg, #c48a0c, #f2b51d 45%, #ffe08a 70%, #f2b51d); }

/* Bloc titre + client */
.bloc { display: flex; justify-content: space-between; align-items: flex-start; gap: 10mm; margin: 8mm 0 7mm; }
.document h1 { margin: 0; font-family: 'Montserrat', sans-serif; font-weight: 800; font-style: italic; font-size: 26pt; line-height: 1; color: #0b2569; }
.document .numero { margin-top: 3mm; font-size: 11.5pt; }
.document .numero strong { font-family: 'Montserrat', sans-serif; font-weight: 700; color: #0b2569; }
.document .date { margin-top: 1mm; color: #48557a; }
.reference-avoir { margin-top: 3mm; padding: 2mm 3mm; border-left: .8mm solid #f2b51d; background: #fbf7ea; font-size: 9.5pt; }
.reference-avoir strong { font-family: 'Montserrat', sans-serif; font-weight: 700; color: #0b2569; }
.reference-avoir .motif { color: #48557a; }
.client { width: 82mm; padding: 4mm 5mm; border: .4mm solid #0b2569; border-radius: 2.5mm; }
.client .libelle { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 7.5pt; letter-spacing: .14em; text-transform: uppercase; color: #c48a0c; }
.client .nom { margin: 1mm 0 1.5mm; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 11.5pt; color: #0b2569; }
.client p { margin: .6mm 0 0; font-size: 9.5pt; color: #2a3656; }
.client .bl { margin-top: 2mm; padding-top: 1.5mm; border-top: .2mm solid #dde3ef; }
.etiquette { display: inline-block; min-width: 11mm; font-size: 8pt; font-weight: 600; color: #8590aa; }

/* Tableau des lignes */
table { width: 100%; border-collapse: collapse; }
.lignes thead th { padding: 2.6mm 3mm; background: #0b2569; color: #fff; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 7.8pt; letter-spacing: .08em; text-transform: uppercase; text-align: left; }
.lignes thead th:first-child { border-radius: 1.5mm 0 0 0; }
.lignes thead th:last-child { border-radius: 0 1.5mm 0 0; text-align: right; }
.lignes td { padding: 2.4mm 3mm; border-bottom: .2mm solid #dde3ef; vertical-align: top; }
.lignes tbody tr:nth-child(even) td { background: #f5f7fc; }
.lignes tr { page-break-inside: avoid; }
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mono { font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.designation { color: #2a3656; }
.precision { font-size: 8.5pt; color: #8590aa; }
.mention-tva { font-size: 8pt; color: #8a5d00; }
.quantite { font-size: 9pt; color: #48557a; }

/* Totaux */
.recap { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; margin-top: 6mm; page-break-inside: avoid; }
.tva { width: 88mm; }
.tva th, .tva td, .totaux td { padding: 1.8mm 3mm; border: .2mm solid #dde3ef; font-size: 9pt; }
.tva th { background: #eaf0fc; color: #0b2569; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 7.5pt; letter-spacing: .06em; text-transform: uppercase; }
.totaux { width: 78mm; }
.totaux td:first-child { color: #48557a; }
.totaux .ttc td { font-weight: 600; color: #0e1a36; }
.totaux .net td { border-color: #0b2569; background: #0b2569; color: #fff; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 10.5pt; }
.totaux .net td:last-child { color: #ffe08a; }
.lettres { margin-top: 5mm; padding: 3mm 4mm; border-left: 1mm solid #f2b51d; background: #fbf7ea; font-size: 9.5pt; page-break-inside: avoid; }
.lettres strong { font-family: 'Montserrat', sans-serif; font-weight: 700; color: #0b2569; }
.mentions { margin-top: 4mm; font-size: 9pt; color: #48557a; }

/* Cachet et signature */
.signature { display: flex; justify-content: flex-end; margin-top: 8mm; page-break-inside: avoid; }
.signature .zone { width: 70mm; min-height: 34mm; padding: 3mm 4mm; border: .3mm dashed #bdc6da; border-radius: 2.5mm; text-align: center; }
.signature .libelle { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; color: #8590aa; }
.signature img { max-width: 58mm; max-height: 30mm; margin-top: 2mm; }

/* Pied de page dans le flux (impression directe, aperçu) */
.pied-flux { margin-top: 10mm; padding-top: 2.5mm; border-top: .5mm solid #f2b51d; font-size: 7.6pt; line-height: 1.45; color: #48557a; text-align: center; page-break-inside: avoid; }
${mode === 'ecran' ? `
/* Aperçu à l'écran : une feuille A4 */
html { background: #fff; }
body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 14mm 10mm; display: flex; flex-direction: column; }
.pied-flux { margin-top: auto; }
.signature { margin-bottom: 10mm; }` : ''}

/* Brouillon */
.filigrane { position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-28deg); font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 80pt; letter-spacing: .1em; color: rgba(11, 37, 105, .07); pointer-events: none; }
</style>
</head>
<body>
${brouillon ? '<div class="filigrane">BROUILLON</div>' : ''}
<header class="entete">
  <img src="${ressources.logo}" alt="">
  <div class="societe">
    <div class="nom">${echapper(entreprise.raison_sociale)}</div>
    ${entreprise.adresse ? `<div>${echapper(entreprise.adresse)}</div>` : ''}
    ${entreprise.tel ? `<div>${echapper(entreprise.tel)}</div>` : ''}
    ${entreprise.email ? `<div>${echapper(entreprise.email)}</div>` : ''}
  </div>
</header>
<div class="filet-or"></div>

<section class="bloc">
  <div class="document">
    <h1>${titre}</h1>
    <div class="numero">N° <strong>${echapper(numero)}</strong></div>
    <div class="date">Date : ${formatDate(facture.date)}</div>
    ${
      facture.type === 'avoir' && facture.origine
        ? `<div class="reference-avoir">Annule la facture N° <strong>${echapper(facture.origine.numero ?? '')}</strong> du ${formatDate(facture.origine.date)}${
            facture.notes ? `<br><span class="motif">Motif : ${echapper(facture.notes)}</span>` : ''
          }</div>`
        : ''
    }
  </div>
  <div class="client">
    <div class="libelle">Client</div>
    <div class="nom">${echapper(facture.client_raison_sociale)}</div>
    ${coordonneesClient}
  </div>
</section>

<table class="lignes">
  <thead>
    <tr><th style="width:24%">N° TC</th><th style="width:11%">Type</th><th>Zone de livraison</th><th style="width:13%">Nature</th><th style="width:18%">Prix HT (FCFA)</th></tr>
  </thead>
  <tbody>${lignes}</tbody>
</table>

<section class="recap">
  <table class="tva">
    <thead><tr><th>Base soumise à TVA</th><th>Taux</th><th>Montant TVA</th></tr></thead>
    <tbody><tr><td class="num">${montant(facture.base_tva)}</td><td class="num">${facture.taux_tva} %</td><td class="num">${montant(facture.total_tva)}</td></tr></tbody>
  </table>
  <table class="totaux">
    <tbody>
      <tr><td>Total HT</td><td class="num">${montant(facture.total_ht)}</td></tr>
      <tr><td>TVA ${facture.taux_tva} %</td><td class="num">${montant(facture.total_tva)}</td></tr>
      <tr class="ttc"><td>Total TTC</td><td class="num">${montant(facture.total_ttc)}</td></tr>
      <tr class="net"><td>${facture.type === 'avoir' ? 'Montant de l’avoir' : 'Net à payer'}</td><td class="num">${montant(facture.total_ttc)} FCFA</td></tr>
    </tbody>
  </table>
</section>

<div class="lettres">
  Arrêté${facture.type === 'avoir' ? ' le présent avoir' : 'e la présente facture'} à la somme de :
  <strong>${echapper(montantEnLettres(facture.total_ttc))}</strong>
</div>
${entreprise.mentions ? `<div class="mentions">${texte(entreprise.mentions)}</div>` : ''}

<section class="signature">
  <div class="zone">
    <div class="libelle">Cachet et signature</div>
    ${ressources.cachet ? `<img src="${ressources.cachet}" alt="">` : ''}
  </div>
</section>
${mode === 'pdf' ? '' : `<footer class="pied-flux">${contenuPied}</footer>`}
</body>
</html>`

  return { html, pied }
}
