<script lang="ts">
  import type { Snippet } from 'svelte'

  // En-tête d'écran : titre, sous-titre et actions.
  let {
    titre,
    sousTitre = '',
    icone,
    actions
  }: { titre: string; sousTitre?: string; icone?: Snippet; actions?: Snippet } = $props()
</script>

<header class="entete">
  {#if icone}<span class="icone">{@render icone()}</span>{/if}
  <div class="textes">
    <h1>{titre}</h1>
    {#if sousTitre}<p>{sousTitre}</p>{/if}
  </div>
  {#if actions}<div class="entete-actions">{@render actions()}</div>{/if}
</header>

<style>
  .entete {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    padding-bottom: 16px;
    margin-bottom: 22px;
    border-bottom: 1px solid var(--filet);
  }

  .icone {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    background: var(--p);
    color: var(--a);
  }

  .textes {
    flex: 1;
  }

  h1 {
    font-size: 1.6em;
  }

  p {
    color: var(--texte-2);
  }

  .entete-actions {
    display: flex;
    gap: 10px;
  }
</style>
