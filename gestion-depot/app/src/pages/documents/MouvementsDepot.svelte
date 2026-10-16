<script lang="ts">
  import Apercu from '../../composants/Apercu.svelte'
  import { dateCourte, entier } from '../../lib/format'
  import type { OperationDepot, RapportPeriode } from '../../lib/types'

  // Chapitre 9 : mouvements du dépôt — réceptions et alimentations sur la période, par produit.
  let {
    rapport: r,
    receptions,
    alimentations,
    onfermer
  }: { rapport: RapportPeriode; receptions: OperationDepot[]; alimentations: OperationDepot[]; onfermer: () => void } = $props()
  const produits = $derived(r.produits.filter((p) => p.recu_depot || p.alimente))
</script>

<Apercu titre="Mouvements du dépôt" periode="Du {dateCourte(r.du)} au {dateCourte(r.au)}" {onfermer}>
  <div class="doc-resume">
    <div><span>Réceptions</span><strong>{receptions.length}</strong></div>
    <div><span>Reçu au dépôt</span><strong>{entier(r.recu_depot)} bt</strong></div>
    <div><span>Alimentations</span><strong>{alimentations.length}</strong></div>
    <div><span>Transféré en boutique</span><strong>{entier(r.alimente)} bt</strong></div>
  </div>

  <h2 class="doc-section">Par produit (bouteilles)</h2>
  <table class="doc-table">
    <thead><tr><th>Produit</th><th class="nb">Reçu au dépôt</th><th class="nb">Transféré en boutique</th><th class="nb">Différence</th></tr></thead>
    <tbody>
      {#each produits as p (p.produit_id)}
        <tr><td>{p.designation}</td><td class="nb">{entier(p.recu_depot)}</td><td class="nb">{entier(p.alimente)}</td><td class="nb">{entier(p.recu_depot - p.alimente)}</td></tr>
      {:else}
        <tr><td colspan="4">Aucun mouvement du dépôt sur la période.</td></tr>
      {/each}
    </tbody>
    <tfoot><tr><td>Total</td><td class="nb">{entier(r.recu_depot)}</td><td class="nb">{entier(r.alimente)}</td><td class="nb">{entier(r.recu_depot - r.alimente)}</td></tr></tfoot>
  </table>

  {#each [{ titre: 'Réceptions fournisseur', liste: receptions, recep: true }, { titre: 'Alimentations de la boutique', liste: alimentations, recep: false }] as bloc (bloc.titre)}
    <h2 class="doc-section">{bloc.titre}</h2>
    <table class="doc-table">
      <thead><tr><th style="width: 12%">Date</th><th style="width: 20%">{bloc.recep ? 'Fournisseur / BL' : 'Origine'}</th><th>Produits</th><th class="nb" style="width: 10%">Bouteilles</th></tr></thead>
      <tbody>
        {#each bloc.liste as o (o.id)}
          <tr>
            <td>{dateCourte(o.date)}</td>
            <td>{o.origine || '—'}{o.reference ? ` · ${o.reference}` : ''}</td>
            <td>{o.lignes.map((l) => `${l.designation} : ${l.quantite}`).join(' · ')}</td>
            <td class="nb">{entier(o.bouteilles)}</td>
          </tr>
        {:else}
          <tr><td colspan="4">Aucune opération.</td></tr>
        {/each}
      </tbody>
    </table>
  {/each}
</Apercu>
