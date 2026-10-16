<script lang="ts">
  import Apercu from '../../composants/Apercu.svelte'
  import { global } from '../../lib/etat.svelte'
  import { dateCourte, entier, fcfa } from '../../lib/format'
  import type { RapportPeriode } from '../../lib/types'

  // Chapitre 9 : rapport de période (ventes par produit et catégorie, encaissements par jour, écarts, dépenses).
  let { rapport: r, onfermer }: { rapport: RapportPeriode; onfermer: () => void } = $props()
  const categorie = (c: string) => global.references?.categories.find((x) => x.code === c)?.libelle ?? c
  const signe = (n: number) => (n > 0 ? `+${fcfa(n)}` : fcfa(n))
</script>

<Apercu titre="Rapport de période" periode="Du {dateCourte(r.du)} au {dateCourte(r.au)}" {onfermer}>
  <div class="doc-resume">
    <div><span>Journées</span><strong>{r.totaux.journees}</strong></div>
    <div><span>Ventes</span><strong>{fcfa(r.totaux.ventes)} F</strong></div>
    <div><span>Reçu</span><strong>{fcfa(r.totaux.recu)} F</strong></div>
    <div><span>Dépenses</span><strong>{fcfa(r.totaux.depenses)} F</strong></div>
    <div><span>Écart cumulé</span><strong class:rouge={r.totaux.ecart < 0}>{signe(r.totaux.ecart)} F</strong></div>
    <div><span>Bouteilles</span><strong>{entier(r.totaux.bouteilles)}</strong></div>
  </div>

  <h2 class="doc-section">Ventes par produit</h2>
  <table class="doc-table">
    <thead><tr><th>Produit</th><th>Catégorie</th><th class="nb">Vendues (bt)</th><th class="nb">Montant (F)</th><th class="nb">Casse (bt)</th></tr></thead>
    <tbody>
      {#each r.produits.filter((p) => p.bouteilles_vendues || p.casse) as p (p.produit_id)}
        <tr><td>{p.designation}</td><td>{categorie(p.categorie)}</td><td class="nb">{entier(p.bouteilles_vendues)}</td><td class="nb">{fcfa(p.montant)}</td><td class="nb" class:rouge={p.casse > 0}>{p.casse || '—'}</td></tr>
      {:else}
        <tr><td colspan="5">Aucune vente sur la période.</td></tr>
      {/each}
    </tbody>
    <tfoot><tr><td colspan="2">Total</td><td class="nb">{entier(r.totaux.bouteilles)}</td><td class="nb">{fcfa(r.totaux.ventes)}</td><td class="nb">{r.casse}</td></tr></tfoot>
  </table>

  <div class="doc-colonnes">
    <div>
      <h2 class="doc-section">Ventes par catégorie</h2>
      <table class="doc-table">
        <thead><tr><th>Catégorie</th><th class="nb">Bouteilles</th><th class="nb">Montant (F)</th><th class="nb">Part</th></tr></thead>
        <tbody>
          {#each r.categories as c (c.categorie)}
            <tr><td>{categorie(c.categorie)}</td><td class="nb">{entier(c.bouteilles)}</td><td class="nb">{fcfa(c.montant)}</td><td class="nb">{r.totaux.ventes ? Math.round((c.montant * 100) / r.totaux.ventes) : 0} %</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <div>
      <h2 class="doc-section">Dépenses</h2>
      <table class="doc-table">
        <thead><tr><th>Libellé</th><th class="nb">Montant (F)</th></tr></thead>
        <tbody>
          {#each r.depenses as [libelle, montant] (libelle)}<tr><td>{libelle}</td><td class="nb">{fcfa(montant)}</td></tr>{:else}<tr><td colspan="2">Aucune dépense.</td></tr>{/each}
        </tbody>
        <tfoot><tr><td>Total</td><td class="nb">{fcfa(r.totaux.depenses)}</td></tr></tfoot>
      </table>
    </div>
  </div>

  <h2 class="doc-section">Encaissements et écarts par jour</h2>
  <table class="doc-table">
    <thead><tr><th>Date</th><th class="nb">Bouteilles</th><th class="nb">Ventes</th><th class="nb">Reçu</th><th class="nb">Dépenses</th><th class="nb">Écart</th><th class="nb">Écart cumulé</th></tr></thead>
    <tbody>
      {#each r.jours as j, i (j.date)}
        {@const cumul = r.jours.slice(0, i + 1).reduce((t, x) => t + x.ecart, 0)}
        <tr>
          <td>{dateCourte(j.date)}</td>
          <td class="nb">{entier(j.bouteilles_vendues)}</td>
          <td class="nb">{fcfa(j.total_ventes)}</td>
          <td class="nb">{fcfa(j.total_recu)}</td>
          <td class="nb">{fcfa(j.total_depenses)}</td>
          <td class="nb" class:rouge={j.ecart < 0}>{signe(j.ecart)}</td>
          <td class="nb" class:rouge={cumul < 0}>{signe(cumul)}</td>
        </tr>
      {:else}
        <tr><td colspan="7">Aucune journée validée sur la période.</td></tr>
      {/each}
    </tbody>
    <tfoot><tr><td>Total</td><td class="nb">{entier(r.totaux.bouteilles)}</td><td class="nb">{fcfa(r.totaux.ventes)}</td><td class="nb">{fcfa(r.totaux.recu)}</td><td class="nb">{fcfa(r.totaux.depenses)}</td><td class="nb">{signe(r.totaux.ecart)}</td><td></td></tr></tfoot>
  </table>
  <p class="doc-note">Seules les journées validées sont prises en compte. Écart = argent reçu + dépenses − ventes (négatif = manquant).</p>
</Apercu>
