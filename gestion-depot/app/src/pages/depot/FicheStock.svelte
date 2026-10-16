<script lang="ts">
  import { onMount } from 'svelte'
  import { Printer } from '@lucide/svelte'
  import Apercu from '../../composants/Apercu.svelte'
  import { appel } from '../../lib/api'
  import { global } from '../../lib/etat.svelte'
  import { dateCourte, enConditionnements, entier } from '../../lib/format'
  import type { MouvementStock, Produit } from '../../lib/types'

  // EF-23 : tous les mouvements d'un produit, avec les soldes après chacun.
  let produits = $state<Produit[]>([])
  let choisi = $state('')
  let mouvements = $state<MouvementStock[]>([])
  let apercu = $state(false)

  const TYPES: Record<string, string> = {
    ouverture: 'Stock d’ouverture',
    reception: 'Réception',
    alimentation: 'Alimentation',
    vente: 'Ventes',
    casse: 'Casse',
    inventaire: 'Inventaire',
    correction: 'Correction'
  }

  onMount(async () => {
    produits = await appel<Produit[]>('produits_lister', { inclureInactifs: true, date: global.date })
    if (produits.length) {
      choisi = String(produits[0]!.id)
      await charger()
    }
  })

  async function charger() {
    mouvements = (await appel<MouvementStock[]>('fiche_stock', { produitId: Number(choisi) })).reverse()
  }

  const produit = $derived(produits.find((p) => String(p.id) === choisi))
  const fmt = (bt: number) => (produit ? enConditionnements(bt, produit.bt_par_conditionnement, produit.conditionnement, produit.conditionnement_pluriel) : '')
</script>

<section class="barre">
  <label class="champ">
    <span>Produit</span>
    <select class="saisie" bind:value={choisi} onchange={charger}>
      {#each produits as p (p.id)}<option value={String(p.id)}>{p.designation}</option>{/each}
    </select>
  </label>
  {#if mouvements.length}
    <dl>
      <div><dt>Dépôt</dt><dd>{fmt(mouvements[0]!.solde_depot)}</dd></div>
      <div><dt>Boutique</dt><dd>{entier(mouvements[0]!.solde_boutique)} bt</dd></div>
      <div><dt>Total</dt><dd>{entier(mouvements[0]!.solde_depot + mouvements[0]!.solde_boutique)} bt</dd></div>
    </dl>
    <button class="btn btn-s imprimer" onclick={() => (apercu = true)}><Printer size={17} /> Imprimer</button>
  {/if}
</section>

{#if apercu && produit}
  <Apercu titre="Fiche de stock — {produit.designation}" periode="Situation au {dateCourte(global.date)} · {produit.bt_par_conditionnement} bt par {produit.conditionnement}" onfermer={() => (apercu = false)}>
    <div class="doc-resume">
      <div><span>Dépôt</span><strong>{fmt(mouvements[0]!.solde_depot)}</strong></div>
      <div><span>Boutique</span><strong>{entier(mouvements[0]!.solde_boutique)} bt</strong></div>
      <div><span>Total</span><strong>{entier(mouvements[0]!.solde_depot + mouvements[0]!.solde_boutique)} bt</strong></div>
    </div>
    <table class="doc-table">
      <thead><tr><th>Date</th><th>Mouvement</th><th>Lieu</th><th class="nb">Quantité (bt)</th><th class="nb">Solde dépôt</th><th class="nb">Solde boutique</th><th>Motif</th></tr></thead>
      <tbody>
        {#each [...mouvements].reverse() as m, i (i)}
          <tr>
            <td>{dateCourte(m.date)}</td>
            <td>{TYPES[m.type_mouvement] ?? m.type_mouvement}</td>
            <td>{m.lieu === 'depot' ? 'Dépôt' : 'Boutique'}</td>
            <td class="nb" class:rouge={m.quantite < 0}>{m.quantite > 0 ? '+' : ''}{entier(m.quantite)}</td>
            <td class="nb">{fmt(m.solde_depot)}</td>
            <td class="nb">{entier(m.solde_boutique)}</td>
            <td>{m.motif}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </Apercu>
{/if}

<section class="carte" style="padding: 4px 6px">
  <table class="tableau">
    <thead>
      <tr><th>Date</th><th>Mouvement</th><th>Lieu</th><th class="nb">Quantité (bt)</th><th class="nb">Solde dépôt</th><th class="nb">Solde boutique</th><th>Motif</th></tr>
    </thead>
    <tbody>
      {#each mouvements as m, i (i)}
        <tr>
          <td>{dateCourte(m.date)}</td>
          <td>{TYPES[m.type_mouvement] ?? m.type_mouvement}</td>
          <td class="discret">{m.lieu === 'depot' ? 'Dépôt' : 'Boutique'}</td>
          <td class="nb" class:negatif={m.quantite < 0}><strong>{m.quantite > 0 ? '+' : ''}{entier(m.quantite)}</strong></td>
          <td class="nb">{fmt(m.solde_depot)}</td>
          <td class="nb">{entier(m.solde_boutique)}</td>
          <td class="discret">{m.motif}</td>
        </tr>
      {:else}
        <tr><td colspan="7" class="vide">Aucun mouvement pour ce produit.</td></tr>
      {/each}
    </tbody>
  </table>
</section>

<style>
  .barre {
    display: flex;
    align-items: flex-end;
    gap: 30px;
    margin-bottom: 14px;
  }

  .imprimer {
    margin-left: auto;
  }

  .barre .champ {
    width: 300px;
  }

  dl {
    display: flex;
    gap: 0;
  }

  dl div {
    padding: 0 20px;
    border-left: 3px solid var(--p);
  }

  dt {
    color: var(--texte-3);
    font-size: 0.78em;
    font-weight: 700;
    text-transform: uppercase;
  }

  dd {
    font-weight: 800;
    font-size: 1.1em;
  }

  .negatif {
    color: var(--danger);
  }
</style>
