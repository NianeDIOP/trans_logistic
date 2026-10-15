<script lang="ts">
  import { onMount } from 'svelte'
  import { Minus, Square, Copy, X } from '@lucide/svelte'
  import { global, route } from '../lib/etat.svelte'

  // Fenêtre sans cadre : la barre de titre et ses boutons sont dessinés par l'application.
  let agrandie = $state(false)
  let fenetre: import('@tauri-apps/api/window').Window | null = null

  const TITRES: Record<string, string> = {
    accueil: '',
    fiche: 'Fiche du jour',
    depot: 'Dépôt',
    situation: 'Situation',
    historique: 'Historique',
    parametres: 'Paramètres'
  }

  onMount(() => {
    if (!window.__TAURI_INTERNALS__) return
    let arret: (() => void) | undefined
    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      fenetre = getCurrentWindow()
      agrandie = await fenetre.isMaximized()
      arret = await fenetre.onResized(async () => (agrandie = (await fenetre?.isMaximized()) ?? false))
    })
    return () => arret?.()
  })
</script>

<header class="barre" data-tauri-drag-region>
  <img src="/icone.svg" alt="" class="embleme" data-tauri-drag-region />
  <span class="titre" data-tauri-drag-region>
    <strong data-tauri-drag-region>{global.identite?.nom_commercial ?? 'Gestion Dépôt et Boutique'}</strong>
    <span class="appli" data-tauri-drag-region>· Dépôt et boutique</span>
    {#if TITRES[route.page]}<span class="sep" data-tauri-drag-region>/</span><span data-tauri-drag-region>{TITRES[route.page]}</span>{/if}
  </span>
  <div class="boutons">
    <button aria-label="Réduire" onclick={() => fenetre?.minimize()}><Minus size={15} /></button>
    <button aria-label={agrandie ? 'Restaurer' : 'Agrandir'} onclick={() => fenetre?.toggleMaximize()}>
      {#if agrandie}<Copy size={13} />{:else}<Square size={12} />{/if}
    </button>
    <button class="fermer" aria-label="Fermer" onclick={() => fenetre?.close()}><X size={16} /></button>
  </div>
</header>

<style>
  .barre {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 38px;
    padding-left: 12px;
    background: var(--p);
    color: var(--sur-p);
    border-bottom: 2px solid var(--a);
    user-select: none;
    flex: none;
  }

  .embleme {
    width: 22px;
    height: 22px;
  }

  .titre {
    flex: 1;
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.86em;
    white-space: nowrap;
    overflow: hidden;
  }

  .appli {
    color: var(--a);
    font-weight: 700;
  }

  .sep {
    opacity: 0.5;
  }

  .boutons {
    display: flex;
    height: 100%;
  }

  .boutons button {
    display: grid;
    place-items: center;
    width: 46px;
    height: 100%;
    border: 0;
    background: none;
    color: var(--sur-p);
    cursor: pointer;
  }

  .boutons button:hover {
    background: color-mix(in srgb, var(--sur-p) 14%, transparent);
  }

  .boutons .fermer:hover {
    background: #c42b1c;
  }
</style>
