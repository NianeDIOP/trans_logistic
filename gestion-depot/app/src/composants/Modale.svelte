<script lang="ts">
  import type { Snippet } from 'svelte'
  import { X } from '@lucide/svelte'

  let {
    titre,
    sousTitre = '',
    largeur = 560,
    onfermer,
    children,
    pied
  }: { titre: string; sousTitre?: string; largeur?: number; onfermer: () => void; children: Snippet; pied?: Snippet } = $props()

  function touche(e: KeyboardEvent) {
    if (e.key === 'Escape') onfermer()
  }
</script>

<svelte:window onkeydown={touche} />

<div class="voile" role="presentation" onmousedown={(e) => e.target === e.currentTarget && onfermer()}>
  <div class="modale" role="dialog" aria-modal="true" aria-label={titre} style:width="{largeur}px">
    <header>
      <div>
        <h2>{titre}</h2>
        {#if sousTitre}<p>{sousTitre}</p>{/if}
      </div>
      <button class="btn-icone" aria-label="Fermer" onclick={onfermer}><X size={18} /></button>
    </header>
    <div class="corps">{@render children()}</div>
    {#if pied}<footer>{@render pied()}</footer>{/if}
  </div>
</div>

<style>
  .voile {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgb(8 20 18 / 45%);
    backdrop-filter: blur(2px);
  }

  .modale {
    display: flex;
    flex-direction: column;
    max-width: 100%;
    max-height: calc(100vh - 48px);
    background: var(--carte);
    border-radius: 0;
    box-shadow: 0 30px 80px rgb(0 0 0 / 30%);
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 20px 22px 14px;
    border-bottom: 1px solid var(--filet);
  }

  header p {
    color: var(--texte-2);
    margin-top: 2px;
  }

  .corps {
    padding: 20px 22px;
    overflow-y: auto;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 22px;
    border-top: 1px solid var(--filet);
    background: var(--survol);
  }
</style>
