<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Printer, X } from '@lucide/svelte'
  import EnTeteDocument from './EnTeteDocument.svelte'
  import { global } from '../lib/etat.svelte'
  import { dateCourte, aujourdhui } from '../lib/format'

  // Aperçu avant impression d'un document A4 (EF-32, ET-04). « Imprimer » ouvre la fenêtre d'impression
  // de Windows : choisir l'imprimante, ou « Microsoft Print to PDF » pour obtenir un PDF.
  let {
    titre,
    periode,
    paysage = false,
    onfermer,
    children,
    actions
  }: { titre: string; periode: string; paysage?: boolean; onfermer: () => void; children: Snippet; actions?: Snippet } = $props()

  const pres = global.presentation!
  const themes = global.references!.themes
  let theme = $state(pres.theme_document)
  let modele = $state(pres.modele_document)
  const couleurs = $derived(themes.find((t) => t.code === theme) ?? themes[0])
  const maintenant = new Date()
  const edition = `Édité le ${dateCourte(aujourdhui())} à ${String(maintenant.getHours()).padStart(2, '0')}:${String(maintenant.getMinutes()).padStart(2, '0')}`

  /** Déplace l'aperçu directement sous <body> : à l'impression, tout le reste est masqué. */
  function portail(noeud: HTMLElement) {
    document.body.appendChild(noeud)
    return { destroy: () => noeud.remove() }
  }

  // Format de page, marges et pied de page numéroté « page x / y » (EF-52).
  $effect(() => {
    const echapper = (t: string) => t.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s*\n\s*/g, ' · ')
    const pied = echapper([global.identite?.nom_commercial, pres.pied_page].filter(Boolean).join(' — '))
    const style = document.createElement('style')
    style.textContent = `@page {
      size: A4 ${paysage ? 'landscape' : 'portrait'};
      margin: ${modele === 'compact' ? '9mm 9mm 13mm' : '13mm 12mm 15mm'};
      @bottom-left { content: "${pied}"; font: 8pt sans-serif; color: #6b7a78; }
      @bottom-right { content: "${echapper(edition)} · page " counter(page) " / " counter(pages); font: 8pt sans-serif; color: #6b7a78; }
    }`
    document.head.appendChild(style)
    return () => style.remove()
  })

  function touche(e: KeyboardEvent) {
    if (e.key === 'Escape') onfermer()
  }
</script>

<svelte:window onkeydown={touche} />

<div class="impression" use:portail role="dialog" aria-modal="true" aria-label={titre}>
  <div class="barre non-imprime">
    <strong>{titre}</strong>
    <label>
      Couleurs
      <select class="saisie" bind:value={theme}>
        {#each themes as t (t.code)}<option value={t.code}>{t.nom}</option>{/each}
      </select>
    </label>
    <label>
      Mise en page
      <select class="saisie" bind:value={modele}>
        {#each global.references!.modeles as m (m.code)}<option value={m.code}>{m.nom}</option>{/each}
      </select>
    </label>
    <span class="espace"></span>
    {#if actions}{@render actions()}{/if}
    <button class="btn btn-p" onclick={() => window.print()}><Printer size={17} /> Imprimer ou PDF</button>
    <button class="btn-icone" aria-label="Fermer" onclick={onfermer}><X size={20} /></button>
  </div>
  <div class="defilement">
    <div class="page" class:paysage>
      <article class="feuille modele-{modele}" style:--dp={couleurs.principal} style:--da={couleurs.accent}>
        <EnTeteDocument p={{ ...pres, modele_document: modele }} />
        <div class="doc-titre">
          <h1>{titre}</h1>
          <p>{periode}<br />{edition}</p>
        </div>
        {@render children()}
        <div class="doc-pied">
          <span>{[global.identite?.nom_commercial, pres.pied_page].filter(Boolean).join(' — ')}</span>
          <span>{edition} · page x / y</span>
        </div>
      </article>
    </div>
  </div>
</div>

<style>
  .impression {
    position: fixed;
    inset: 38px 0 0;
    z-index: 80;
    display: flex;
    flex-direction: column;
    background: color-mix(in srgb, var(--fond) 70%, #6c7a78);
    font-family: var(--police);
  }

  .barre {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 20px;
    background: var(--carte);
    border-bottom: 1px solid var(--filet);
    box-shadow: var(--ombre);
  }

  .barre strong {
    font-size: 1.05em;
  }

  .barre label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--texte-2);
    font-size: 0.9em;
    font-weight: 600;
  }

  .barre select {
    height: 34px;
    width: auto;
  }

  .espace {
    flex: 1;
  }

  .defilement {
    flex: 1;
    overflow: auto;
    padding: 24px;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 10px 40px rgb(0 0 0 / 25%);
  }

  .page.paysage {
    width: 297mm;
    min-height: 210mm;
  }
</style>
