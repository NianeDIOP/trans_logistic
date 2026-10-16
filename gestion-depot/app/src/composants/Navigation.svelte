<script lang="ts">
  import { Lock } from '@lucide/svelte'
  import { appel } from '../lib/api'
  import { aller, global, MODULES, route } from '../lib/etat.svelte'

  async function verrouiller() {
    await appel('verrouiller')
    global.verrouille = true
  }

  // Barre de navigation horizontale ; raccourcis : chiffres 1 à 5, Échap pour l'accueil.
  function touche(e: KeyboardEvent) {
    const cible = e.target as HTMLElement
    if (e.ctrlKey || e.altKey || e.metaKey || cible.closest('input, select, textarea, [role="dialog"]')) return
    if (document.querySelector('[role="dialog"]')) return
    const n = Number(e.key)
    if (n >= 1 && n < MODULES.length) aller(MODULES[n]!.page)
    else if (e.key === 'Escape') aller('accueil')
  }
</script>

<svelte:window onkeydown={touche} />

<nav class="navigation" aria-label="Modules">
  {#each MODULES as m, i (m.page)}
    <button class:actif={route.page === m.page} onclick={() => aller(m.page)} title={i ? `Touche ${i}` : 'Échap'}>
      <m.Icone size={17} strokeWidth={2} />
      {m.titre}
    </button>
  {/each}
  {#if global.securite?.protege}
    <button class="verrouiller" onclick={verrouiller} title="Verrouiller l’application"><Lock size={16} /> Verrouiller</button>
  {/if}
</nav>

<style>
  .verrouiller {
    margin-left: auto;
  }

  .navigation {
    display: flex;
    gap: 2px;
    padding: 0 28px;
    background: var(--carte);
    border-bottom: 1px solid var(--filet);
    flex: none;
  }

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 46px;
    padding: 0 16px;
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--texte-2);
    font-weight: 700;
    cursor: pointer;
  }

  button:hover {
    color: var(--texte);
    background: var(--survol);
  }

  button.actif {
    color: var(--p);
    border-bottom-color: var(--a);
  }

  :global(:root[data-mode='sombre']) button.actif {
    color: var(--texte);
  }
</style>
