<script lang="ts">
  import { Store, Package, Boxes, ClipboardCheck, Palette, ShieldCheck, Info } from '@lucide/svelte'
  import EnTete from '../composants/EnTete.svelte'
  import { aller, route, type Onglet } from '../lib/etat.svelte'
  import Boutique from './parametres/Boutique.svelte'
  import Produits from './parametres/Produits.svelte'
  import Conditionnements from './parametres/Conditionnements.svelte'
  import Ouverture from './parametres/Ouverture.svelte'
  import Apparence from './parametres/Apparence.svelte'
  import APropos from './parametres/APropos.svelte'
  import Securite from './parametres/Securite.svelte'

  const ONGLETS: { id: Onglet; titre: string; Icone: typeof Store }[] = [
    { id: 'boutique', titre: 'Boutique', Icone: Store },
    { id: 'produits', titre: 'Produits et prix', Icone: Package },
    { id: 'conditionnements', titre: 'Conditionnements', Icone: Boxes },
    { id: 'ouverture', titre: 'Stock d’ouverture', Icone: ClipboardCheck },
    { id: 'apparence', titre: 'Apparence', Icone: Palette },
    { id: 'securite', titre: 'Sauvegarde et sécurité', Icone: ShieldCheck },
    { id: 'apropos', titre: 'À propos', Icone: Info }
  ]
</script>

<EnTete titre="Paramètres" sousTitre="Tout ce qui entre dans une fiche ou un document vient d’ici." />

<nav class="onglets" aria-label="Rubriques">
  {#each ONGLETS as o (o.id)}
    <button class:actif={route.onglet === o.id} onclick={() => aller('parametres', o.id)}>
      <o.Icone size={17} />
      {o.titre}
    </button>
  {/each}
</nav>

{#if route.onglet === 'boutique'}
  <Boutique />
{:else if route.onglet === 'produits'}
  <Produits />
{:else if route.onglet === 'conditionnements'}
  <Conditionnements />
{:else if route.onglet === 'ouverture'}
  <Ouverture />
{:else if route.onglet === 'apparence'}
  <Apparence />
{:else if route.onglet === 'securite'}
  <Securite />
{:else}
  <APropos />
{/if}

<style>
  .onglets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 22px;
    padding: 4px;
    border: 1px solid var(--filet);
    border-radius: 0;
    background: var(--carte);
    width: fit-content;
  }

  .onglets button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--texte-2);
    font-weight: 700;
    cursor: pointer;
  }

  .onglets button:hover {
    background: var(--survol);
  }

  .onglets button.actif {
    background: var(--p);
    color: var(--sur-p);
  }
</style>
