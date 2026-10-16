<script lang="ts">
  import Apercu from '../../composants/Apercu.svelte'
  import { dateLongue, fcfa } from '../../lib/format'
  import type { LigneFiche } from '../../lib/types'

  // Chapitre 9 : fiche journalière vierge, A4 paysage, produits actifs dans l'ordre de saisie.
  let { date, lignes, onfermer }: { date: string; lignes: LigneFiche[]; onfermer: () => void } = $props()
  let prerempli = $state(true)
</script>

<Apercu titre="Fiche journalière" periode="Journée du {dateLongue(date)}" paysage {onfermer}>
  {#snippet actions()}
    <label class="case"><input type="checkbox" bind:checked={prerempli} /> Stock initial et prix pré-remplis</label>
  {/snippet}
  <table class="doc-table a-remplir">
    <thead>
      <tr>
        <th style="width: 4%">N°</th>
        <th style="width: 19%">Produit</th>
        <th style="width: 8%">Stock initial (bt)</th>
        <th style="width: 7%">Alim. ({lignes[0]?.conditionnement ?? 'cond.'})</th>
        <th style="width: 7%">Alim. (bt)</th>
        <th style="width: 8%">Stock total</th>
        <th style="width: 8%">Restant</th>
        <th style="width: 7%">Casse</th>
        <th style="width: 8%">Ventes</th>
        <th style="width: 9%">Prix</th>
        <th style="width: 11%">Montant</th>
      </tr>
    </thead>
    <tbody>
      {#each lignes as l, i (l.produit_id)}
        <tr>
          <td class="nb">{i + 1}</td>
          <td><strong>{l.designation}</strong> <small>({l.bt_par_conditionnement} bt)</small></td>
          <td class="nb">{prerempli ? l.stock_initial : ''}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td class="nb">{prerempli && l.prix !== null ? fcfa(l.prix) : ''}</td>
          <td></td>
        </tr>
      {/each}
    </tbody>
  </table>
  <div class="caisse-vierge">
    <table class="doc-table a-remplir">
      <tbody>
        <tr><th>Total des ventes</th><td></td></tr>
        <tr><th>Argent remis</th><td></td></tr>
        <tr><th>Dépenses (détail ci-contre)</th><td></td></tr>
        <tr><th>Écart (reçu + dépenses − ventes)</th><td></td></tr>
      </tbody>
    </table>
    <table class="doc-table a-remplir">
      <thead><tr><th>Dépense</th><th style="width: 32%">Montant</th></tr></thead>
      <tbody>
        {#each [1, 2, 3] as k (k)}<tr><td></td><td></td></tr>{/each}
      </tbody>
    </table>
    <div class="observations">Observations :</div>
  </div>
  <div class="doc-signatures">
    <div>Le vendeur</div>
    <div>Le propriétaire</div>
  </div>
</Apercu>

<style>
  .caisse-vierge {
    display: grid;
    grid-template-columns: 1.1fr 1fr 1fr;
    gap: 14px;
    margin-top: 12px;
    break-inside: avoid;
  }

  .caisse-vierge th {
    width: 58%;
    text-align: left !important;
  }

  .observations {
    border: 1px solid #9aa8a5;
    padding: 4px 8px;
    font-size: 8.5pt;
    color: #55615f;
  }

  small {
    color: #6b7a78;
    font-size: 7.5pt;
  }
</style>
