<script lang="ts">
  import { CalendarDays, ChartColumn } from '@lucide/svelte'
  import EnTete from '../composants/EnTete.svelte'
  import Journees from './historique/Journees.svelte'
  import Rapport from './historique/Rapport.svelte'

  // Historique et rapports (EF-30, EF-31).
  type Onglet = 'journees' | 'rapport'
  let onglet = $state<Onglet>(location.hash.split('/')[2] === 'rapport' ? 'rapport' : 'journees')
</script>

<EnTete titre="Historique et rapports" sousTitre="Journées enregistrées, ventes par produit et par catégorie, encaissements, écarts de caisse et mouvements du dépôt." />

<nav class="onglets-module" aria-label="Rubriques de l’historique">
  <button class:actif={onglet === 'journees'} onclick={() => (onglet = 'journees')}><CalendarDays size={17} /> Journées</button>
  <button class:actif={onglet === 'rapport'} onclick={() => (onglet = 'rapport')}><ChartColumn size={17} /> Rapport de période</button>
</nav>

{#if onglet === 'journees'}
  <Journees />
{:else}
  <Rapport />
{/if}
