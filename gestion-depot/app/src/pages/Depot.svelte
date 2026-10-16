<script lang="ts">
  import { PackagePlus, ArrowRightLeft, ClipboardCheck, ScrollText } from '@lucide/svelte'
  import EnTete from '../composants/EnTete.svelte'
  import Receptions from './depot/Receptions.svelte'
  import Alimentations from './depot/Alimentations.svelte'
  import Inventaire from './depot/Inventaire.svelte'
  import FicheStock from './depot/FicheStock.svelte'

  type Onglet = 'receptions' | 'alimentations' | 'inventaire' | 'fiche'
  const ONGLETS: { id: Onglet; titre: string; Icone: typeof PackagePlus }[] = [
    { id: 'receptions', titre: 'Réceptions fournisseur', Icone: PackagePlus },
    { id: 'alimentations', titre: 'Alimentations de la boutique', Icone: ArrowRightLeft },
    { id: 'inventaire', titre: 'Inventaire', Icone: ClipboardCheck },
    { id: 'fiche', titre: 'Fiche de stock', Icone: ScrollText }
  ]
  let onglet = $state<Onglet>((location.hash.split('/')[2] as Onglet) || 'receptions')
</script>

<EnTete titre="Dépôt" sousTitre="Entrées du fournisseur, transferts vers la boutique, comptages et historique des mouvements." />

<nav class="onglets" aria-label="Rubriques du dépôt">
  {#each ONGLETS as o (o.id)}
    <button class:actif={onglet === o.id} onclick={() => (onglet = o.id)}><o.Icone size={17} /> {o.titre}</button>
  {/each}
</nav>

{#if onglet === 'receptions'}
  <Receptions />
{:else if onglet === 'alimentations'}
  <Alimentations />
{:else if onglet === 'inventaire'}
  <Inventaire />
{:else}
  <FicheStock />
{/if}

<style>
  .onglets {
    display: flex;
    gap: 0;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--filet);
  }

  .onglets button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--texte-2);
    font-weight: 700;
    cursor: pointer;
  }

  .onglets button.actif {
    color: var(--texte);
    border-bottom-color: var(--a);
  }
</style>
