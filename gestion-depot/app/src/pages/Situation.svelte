<script lang="ts">
  import { onMount } from 'svelte'
  import { Search, TriangleAlert } from '@lucide/svelte'
  import EnTete from '../composants/EnTete.svelte'
  import { appel } from '../lib/api'
  import { global } from '../lib/etat.svelte'
  import { dateCourte, entier, fcfa } from '../lib/format'
  import type { LigneSituation } from '../lib/types'

  let lignes = $state<LigneSituation[]>([])
  let recherche = $state('')
  let categorie = $state('')
  let seulementAlertes = $state(false)
  let erreur = $state('')

  onMount(() => {
    appel<LigneSituation[]>('situation', { date: global.date })
      .then((l) => (lignes = l))
      .catch((e: Error) => (erreur = e.message))
  })

  const filtrees = $derived(
    lignes.filter(
      (l) =>
        (!recherche || l.designation.toLowerCase().includes(recherche.toLowerCase())) &&
        (!categorie || l.categorie === categorie) &&
        (!seulementAlertes || l.alerte_depot || l.alerte_boutique)
    )
  )
  const totaux = $derived({
    depot: filtrees.reduce((s, l) => s + l.depot, 0),
    boutique: filtrees.reduce((s, l) => s + l.boutique, 0),
    total: filtrees.reduce((s, l) => s + l.total, 0),
    valeur: filtrees.reduce((s, l) => s + l.valeur, 0)
  })
  const libelleCategorie = (c: string) => global.references?.categories.find((x) => x.code === c)?.libelle ?? c
</script>

<EnTete titre="Situation des stocks" sousTitre="Au {dateCourte(global.date)} — dépôt, boutique et total, en bouteilles et en conditionnements." />

<section class="filtres">
  <label class="recherche">
    <Search size={17} />
    <input placeholder="Rechercher un produit" bind:value={recherche} />
  </label>
  <select class="saisie" bind:value={categorie} aria-label="Catégorie">
    <option value="">Toutes les catégories</option>
    {#each global.references?.categories ?? [] as c (c.code)}<option value={c.code}>{c.libelle}</option>{/each}
  </select>
  <label class="case"><input type="checkbox" bind:checked={seulementAlertes} /> Sous le seuil uniquement</label>
</section>

{#if erreur}
  <p class="erreur-texte">{erreur}</p>
{:else}
  <section class="carte" style="padding: 6px 8px">
    <table class="tableau">
      <thead>
        <tr>
          <th>Produit</th>
          <th>Catégorie</th>
          <th class="nb">Format</th>
          <th class="nb">Dépôt</th>
          <th class="nb">Boutique (bt)</th>
          <th class="nb">Total (bt)</th>
          <th class="nb">Total</th>
          <th class="nb">Prix</th>
          <th class="nb">Valeur (F)</th>
        </tr>
      </thead>
      <tbody>
        {#each filtrees as l (l.produit_id)}
          <tr>
            <td>
              <strong>{l.designation}</strong>
              {#if l.alerte_depot || l.alerte_boutique}
                <span class="badge badge-alerte"><TriangleAlert size={12} /> seuil</span>
              {/if}
            </td>
            <td class="discret">{libelleCategorie(l.categorie)}</td>
            <td class="nb discret">{l.bt_par_conditionnement} bt/{l.conditionnement}</td>
            <td class="nb" class:rouge={l.alerte_depot}>{l.depot_court}</td>
            <td class="nb" class:rouge={l.alerte_boutique}>{entier(l.boutique)}</td>
            <td class="nb"><strong>{entier(l.total)}</strong></td>
            <td class="nb discret">{l.total_court}</td>
            <td class="nb">{l.prix === null ? '—' : fcfa(l.prix)}</td>
            <td class="nb">{fcfa(l.valeur)}</td>
          </tr>
        {:else}
          <tr><td colspan="9" class="vide">Aucun produit ne correspond.</td></tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">Total ({filtrees.length} produits)</td>
          <td class="nb">{entier(totaux.depot)} bt</td>
          <td class="nb">{entier(totaux.boutique)}</td>
          <td class="nb">{entier(totaux.total)}</td>
          <td></td>
          <td></td>
          <td class="nb">{fcfa(totaux.valeur)}</td>
        </tr>
      </tfoot>
    </table>
  </section>
{/if}

<style>
  .filtres {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }

  .recherche {
    display: flex;
    flex: 1;
    max-width: 380px;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 12px;
    border: 1px solid var(--filet);
    border-radius: 0;
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

  .rouge {
    color: var(--danger);
    font-weight: 700;
  }

  td .badge {
    margin-left: 6px;
  }
</style>
