/**
 * Modèle HTML de la facture (A4), rendu en PDF par Chromium (`printToPDF`).
 * Fonction pure : toutes les ressources (polices, logo, cachet) sont fournies en data URL.
 */
import { formatDate } from '../../core/facture'
import { montantEnLettres } from '../../core/lettres'
import { formatMontant } from '../../core/montants'
import type { Entreprise } from '../../shared/types'
import type { Facture } from '../../shared/factures'
import { modeleParId, themeParId } from '../../shared/modeles'

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

/** Mélange une couleur hexadécimale avec du blanc (ratio 0 → couleur, 1 → blanc). */
export function teinte(hex: string, ratio: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * ratio))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Feuille de style propre à chaque mise en page (complète la feuille commune). */
const CSS_MODELES: Record<string, string> = {
  classique: '',
  bandeau: `
.entete { padding: 5mm 6mm; border-radius: 3mm; background: var(--p); }
.entete .logo-cadre { padding: 2mm 3.5mm; border-radius: 2mm; background: #fff; }
.entete img { height: 19mm; }
.societe, .societe div, .societe .nom { color: var(--sur-p); }
.filet { margin-top: 1.5mm; }
.document h1 { font-style: normal; text-transform: uppercase; letter-spacing: .06em; }
.client { border: 0; background: var(--clair); }`,
  epure: `
.entete { padding-bottom: 4mm; border-bottom: .3mm solid var(--p); }
.filet { display: none; }
.document h1 { font-style: normal; font-weight: 700; text-transform: uppercase; letter-spacing: .18em; font-size: 20pt; }
.client { border: 0; border-left: .6mm solid var(--a); border-radius: 0; padding: 1mm 0 1mm 5mm; }
.lignes thead th { background: none !important; color: var(--p) !important; border-bottom: .6mm solid var(--p); border-radius: 0 !important; }
.lignes tbody tr:nth-child(even) td { background: none; }
.tva th { background: none; border-bottom: .4mm solid var(--p); }
.totaux .net td { background: none !important; color: var(--p) !important; border: 0; border-top: .6mm solid var(--p); font-size: 12pt; }
.totaux .net td:last-child { color: var(--p) !important; }`,
  moderne: `
.entete { padding-left: 5mm; border-left: 2.5mm solid var(--p); }
.filet { display: none; }
.bloc { margin-top: 7mm; }
.document h1 { font-size: 32pt; font-style: normal; letter-spacing: -.01em; }
.document .numero { display: inline-block; margin-top: 4mm; padding: 1.5mm 4mm; border-radius: 10mm; background: var(--clair); }
.client { border: 0; border-radius: 3mm; background: var(--clair); }
.lignes thead th:first-child { border-radius: 2mm 0 0 2mm; }
.lignes thead th:last-child { border-radius: 0 2mm 2mm 0; }
.totaux .net td { background: var(--a) !important; border-color: var(--a) !important; color: #fff !important; font-size: 12pt; }
.totaux .net td:last-child { color: #fff !important; }`,
  compact: `
body { font-size: 9.5pt; }
.entete img { height: 18mm; }
.bloc { margin: 5mm 0 4mm; }
.document h1 { font-size: 20pt; }
.client { padding: 3mm 4mm; }
.lignes td { padding: 1.5mm 2.5mm; }
.lignes thead th { padding: 2mm 2.5mm; }
.recap { margin-top: 4mm; }
.signature { margin-bottom: 31mm; }`
}

export function modeleFacture(
  facture: Facture,
  entreprise: Entreprise,
  ressources: RessourcesPdf,
  mode: ModeRendu = 'pdf',
  presentation?: { modele?: string; theme?: string }
): DocumentPdf {
  const gabarit = modeleParId(presentation?.modele ?? entreprise.modele_facture).id
  const theme = themeParId(presentation?.theme ?? entreprise.theme_facture)
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
    <div style="font-weight:700;color:${theme.principal}">${piedEntreprise}</div>
    ${piedBanque ? `<div>Banque : ${piedBanque}</div>` : ''}
    <div>${piedContacts}</div>`
  const pied = `<div style="width:100%;margin:0 14mm;padding-top:2mm;border-top:0.5mm solid ${theme.accent};
    font-family:'Segoe UI',Arial,sans-serif;font-size:7.5pt;line-height:1.45;color:#2b2b2b;text-align:center;
    -webkit-print-color-adjust:exact">${contenuPied}
    <div style="margin-top:1mm;color:#6b6b6b">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>
  </div>`

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${titre} ${echapper(numero)}</title>
<style>
${ressources.policesCss}
@page { size: A4; margin: 14mm 14mm 24mm; }
:root { --p: ${theme.principal}; --a: ${theme.accent}; --sur-p: ${theme.surPrincipal}; --clair: ${teinte(theme.principal, 0.92)}; --tres-clair: ${teinte(theme.principal, 0.96)}; --filet-t: ${teinte(theme.principal, 0.82)}; --texte: #161616; --texte-2: #333a44; --texte-3: #5b6370; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Source Sans 3', sans-serif; font-size: 10.5pt; line-height: 1.42; color: var(--texte); }
.titre-police { font-family: 'Montserrat', sans-serif; }

/* En-tête */
.entete { display: flex; justify-content: space-between; align-items: center; gap: 8mm; padding-bottom: 4mm; }
.entete img { height: 24mm; display: block; }
.societe { text-align: right; font-size: 10pt; font-weight: 600; color: var(--texte-2); }
.societe .nom { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 14pt; color: var(--p); letter-spacing: .02em; margin-bottom: 1.5mm; }
.filet { height: 1.2mm; border-radius: 1mm; background: var(--a); }

/* Bloc titre + client */
.bloc { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; margin: 6mm 0 5mm; }
.document h1 { margin: 0; font-family: 'Montserrat', sans-serif; font-weight: 800; font-style: italic; font-size: 26pt; line-height: 1; color: var(--p); }
.document .numero { margin-top: 3mm; font-size: 12pt; font-weight: 600; }
.document .numero strong { font-family: 'Montserrat', sans-serif; font-weight: 700; color: var(--p); }
.document .date { margin-top: 1mm; font-weight: 600; color: var(--texte-2); }
.reference-avoir { margin-top: 3mm; padding: 1mm 0 1mm 3mm; border-left: .8mm solid var(--a); font-size: 10pt; }
.reference-avoir strong { font-family: 'Montserrat', sans-serif; font-weight: 700; color: var(--p); }
.reference-avoir .motif { color: var(--texte-2); }
.client { width: 84mm; padding: 4mm 5mm; border: .4mm solid var(--p); border-radius: 2.5mm; }
.client .libelle { font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; color: var(--texte-3); }
.client .nom { margin: 1mm 0 1.5mm; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 12.5pt; color: var(--p); }
.client p { margin: .6mm 0 0; font-size: 10pt; font-weight: 600; color: var(--texte); }
.client .bl { margin-top: 2mm; padding-top: 1.5mm; border-top: .2mm solid var(--filet-t); }
.etiquette { display: inline-block; min-width: 12mm; font-size: 8.5pt; font-weight: 600; color: var(--texte-3); }

/* Tableau des lignes */
table { width: 100%; border-collapse: collapse; }
.lignes thead th { padding: 2.6mm 3mm; background: var(--p); color: var(--sur-p); font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; text-align: left; }
.lignes thead th:first-child { border-radius: 1.5mm 0 0 0; }
.lignes thead th:last-child { border-radius: 0 1.5mm 0 0; text-align: right; }
.lignes td { padding: 2.1mm 3mm; border-bottom: .2mm solid var(--filet-t); vertical-align: top; font-weight: 600; }
.lignes tbody tr:nth-child(even) td { background: var(--tres-clair); }
.lignes tr { page-break-inside: avoid; }
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.mono { font-variant-numeric: tabular-nums; letter-spacing: .02em; }
.designation { color: var(--texte); }
.precision { font-size: 9pt; color: var(--texte-3); }
.mention-tva { font-size: 8.5pt; font-weight: 400; color: var(--texte-3); }
.quantite { font-size: 9.5pt; color: var(--texte-2); }

/* Totaux */
.recap { display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; margin-top: 5mm; page-break-inside: avoid; }
.tva { width: 80mm; }
.tva th, .tva td, .totaux td { padding: 1.6mm 3mm; border: .2mm solid var(--filet-t); font-size: 10pt; font-weight: 600; }
.tva th { background: var(--clair); color: var(--p); font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 8pt; letter-spacing: .06em; text-transform: uppercase; }
.totaux { width: 96mm; }
.totaux td:first-child { white-space: nowrap; }
.totaux td:first-child { color: var(--texte-2); }
.totaux .ttc td { font-weight: 700; color: var(--texte); }
.totaux .sous-total td { color: var(--texte-3); font-size: 9pt; }
.totaux .net td { border-color: var(--p); background: var(--p); color: var(--sur-p); font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 11pt; }
.totaux .net td:last-child { color: var(--sur-p); }
.lettres { margin-top: 4mm; font-size: 10.5pt; font-weight: 600; page-break-inside: avoid; }
.lettres strong { font-family: 'Montserrat', sans-serif; font-weight: 700; color: var(--p); }
.mentions { margin-top: 3mm; font-size: 9.5pt; font-weight: 600; color: var(--texte-2); }

/* Espace laissé vierge pour le cachet et la signature apposés à la main */
.signature { height: 0; margin-bottom: 37mm; }

/* Pied de page dans le flux (impression directe, aperçu) */
.pied-flux { margin-top: 10mm; padding-top: 2.5mm; border-top: .5mm solid var(--a); font-size: 8pt; line-height: 1.45; color: #2b2b2b; text-align: center; page-break-inside: avoid; }
${mode === 'ecran' ? `
/* Aperçu à l'écran : une feuille A4 */
html { background: #fff; }
body { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 14mm 14mm 10mm; display: flex; flex-direction: column; }
.pied-flux { margin-top: auto; }
.signature { margin-bottom: 47mm; }` : ''}

/* Mise en page « ${gabarit} » */
${CSS_MODELES[gabarit] ?? ''}

/* Brouillon */
.filigrane { position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-28deg); font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 80pt; letter-spacing: .1em; color: var(--p); opacity: .07; pointer-events: none; }
</style>
</head>
<body class="modele-${gabarit}">
${brouillon ? '<div class="filigrane">BROUILLON</div>' : ''}
<header class="entete">
  <div class="logo-cadre"><img src="${ressources.logo}" alt=""></div>
  <div class="societe">
    <div class="nom">${echapper(entreprise.raison_sociale)}</div>
    ${entreprise.adresse ? `<div>${echapper(entreprise.adresse)}</div>` : ''}
    ${entreprise.tel ? `<div>${echapper(entreprise.tel)}</div>` : ''}
    ${entreprise.email ? `<div>${echapper(entreprise.email)}</div>` : ''}
  </div>
</header>
<div class="filet"></div>

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
    <thead><tr><th>Base TVA (conteneurs)</th><th>Taux</th><th>Montant TVA</th></tr></thead>
    <tbody><tr><td class="num">${montant(facture.base_tva)}</td><td class="num">${facture.taux_tva} %</td><td class="num">${montant(facture.total_tva)}</td></tr></tbody>
  </table>
  <table class="totaux">
    <tbody>
      <tr><td>Transport HT (conteneurs)</td><td class="num">${montant(facture.base_tva)}</td></tr>
      <tr><td>TVA ${facture.taux_tva} % sur conteneurs</td><td class="num">${montant(facture.total_tva)}</td></tr>
      ${
        facture.total_ht - facture.base_tva !== 0
          ? `<tr><td>Débours hors TVA</td><td class="num">${montant(facture.total_ht - facture.base_tva)}</td></tr>`
          : ''
      }
      <tr class="sous-total"><td>Total HT</td><td class="num">${montant(facture.total_ht)}</td></tr>
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

<section class="signature" aria-hidden="true"></section>
${mode === 'pdf' ? '' : `<footer class="pied-flux">${contenuPied}</footer>`}
</body>
</html>`

  return { html, pied }
}
