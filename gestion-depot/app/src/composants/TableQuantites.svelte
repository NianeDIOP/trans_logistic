<script lang="ts">
  import { Search } from '@lucide/svelte'
  import { enConditionnements, entier, lireEntier, valeur } from '../lib/format'
  import type { Produit } from '../lib/types'

  // Saisie de quantités par produit : conditionnements entiers + bouteilles isolées.
  let {
    produits,
    saisies = $bindable(),
    disponibles = null
  }: { produits: Produit[]; saisies: Record<number, { cond: string; bt: string }>; disponibles?: Record<number, number> | null } = $props()

  let recherche = $state('')
  const invalide = (s: string) => {
    const n = lireEntier(s)
    return n !== null && (Number.isNaN(n) || n < 0)
  }
  const total = (p: Produit) => valeur(saisies[p.id]?.cond ?? '') * p.bt_par_conditionnement + valeur(saisies[p.id]?.bt ?? '')
  const affiches = $derived(produits.filter((p) => !recherche || p.designation.toLowerCase().includes(recherche.toLowerCase())))
</script>

<label class="recherche">
  <Search size={16} />
  <input placeholder="Filtrer les produits" bind:value={recherche} />
</label>
<div class="defile">
  <table class="tableau">
    <thead>
      <tr>
        <th>Produit</th>
        {#if disponibles}<th class="nb">Au dépôt</th>{/if}
        <th class="nb">Conditionnements</th>
        <th class="nb">Bouteilles isolées</th>
        <th class="nb">Total</th>
      </tr>
    </thead>
    <tbody>
      {#each affiches as p (p.id)}
        {@const t = total(p)}
        {@const trop = disponibles !== null && t > (disponibles[p.id] ?? 0)}
        <tr class:rempli={t > 0}>
          <td><strong>{p.designation}</strong> <span class="discret">({p.conditionnement} de {p.bt_par_conditionnement})</span></td>
          {#if disponibles}
            <td class="nb discret">{enConditionnements(disponibles[p.id] ?? 0, p.bt_par_conditionnement, p.conditionnement, p.conditionnement_pluriel)}</td>
          {/if}
          <td class="nb"><input class="saisie nombre petite" class:invalide={invalide(saisies[p.id].cond)} inputmode="numeric" bind:value={saisies[p.id].cond} /></td>
          <td class="nb"><input class="saisie nombre petite" class:invalide={invalide(saisies[p.id].bt)} inputmode="numeric" bind:value={saisies[p.id].bt} /></td>
          <td class="nb" class:trop>{t ? `${entier(t)} bt` : '—'}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .recherche {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 260px;
    height: 36px;
    margin-bottom: 8px;
    padding: 0 10px;
    border: 1px solid var(--filet);
    background: var(--carte);
    color: var(--texte-3);
  }

  .recherche input {
    flex: 1;
    border: 0;
    outline: none;
    background: none;
    color: var(--texte);
  }

  .defile {
    max-height: 46vh;
    overflow-y: auto;
    border: 1px solid var(--filet);
  }

  .defile thead th {
    position: sticky;
    top: 0;
    background: var(--carte);
    z-index: 1;
  }

  .petite {
    width: 92px;
    height: 32px;
  }

  tr.rempli td {
    background: var(--a-pale);
  }

  .trop {
    color: var(--danger);
    font-weight: 800;
  }
</style>
