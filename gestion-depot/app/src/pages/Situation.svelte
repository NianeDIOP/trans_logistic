<script lang="ts">
  import { onMount } from 'svelte'
  import { FileSpreadsheet, Printer, Search, TriangleAlert } from '@lucide/svelte'
  import EnTete from '../composants/EnTete.svelte'
  import Apercu from '../composants/Apercu.svelte'
  import { colonnes, exporterExcel } from '../lib/excel'
  import { appel } from '../lib/api'
  import { global } from '../lib/etat.svelte'
  import { dateCourte, entier, fcfa } from '../lib/format'
  import type { LigneSituation } from '../lib/types'

  let lignes = $state<LigneSituation[]>([])
  let recherche = $state('')
  let categorie = $state('')
  let seulementAlertes = $state(false)
  let erreur = $state('')
  let apercu = $state(false)

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
  const sousSeuil = $derived(filtrees.filter((l) => l.alerte_depot || l.alerte_boutique))

  // EF-02 / chapitre 9 : export Excel de la situation (nombres bruts).
  function excel() {
    exporterExcel(`Situation des stocks ${global.date}`, [
      {
        nom: 'Situation des stocks',
        titre: 'Situation des stocks',
        sous_titre: `Au ${dateCourte(global.date)}`,
        colonnes: colonnes(['Produit', 26], ['Catégorie', 12], ['Bt par cond.', 11], ['Dépôt (bt)', 11], ['Dépôt', 18], ['Boutique (bt)', 13], ['Total (bt)', 11], ['Prix', 10], ['Valeur', 13], ['Sous le seuil', 12]),
        lignes: filtrees.map((l) => [
          l.designation, libelleCategorie(l.categorie), l.bt_par_conditionnement, l.depot, l.depot_court, l.boutique, l.total, l.prix, l.valeur,
          l.alerte_depot || l.alerte_boutique ? 'Oui' : ''
        ]),
        total: ['Total', null, null, totaux.depot, null, totaux.boutique, totaux.total, null, totaux.valeur, sousSeuil.length]
      }
    ])
  }
</script>

<EnTete titre="Situation des stocks" sousTitre="Au {dateCourte(global.date)} — dépôt, boutique et total, en bouteilles et en conditionnements.">
  {#snippet actions()}
    <button class="btn btn-f" onclick={excel}><FileSpreadsheet size={17} /> Excel</button>
    <button class="btn btn-s" onclick={() => (apercu = true)}><Printer size={17} /> Imprimer</button>
  {/snippet}
</EnTete>

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

{#if apercu}
  <Apercu titre="Situation des stocks" periode="Au {dateCourte(global.date)}" onfermer={() => (apercu = false)}>
    <div class="doc-resume">
      <div><span>Produits</span><strong>{filtrees.length}</strong></div>
      <div><span>Dépôt</span><strong>{entier(totaux.depot)} bt</strong></div>
      <div><span>Boutique</span><strong>{entier(totaux.boutique)} bt</strong></div>
      <div><span>Valeur du stock</span><strong>{fcfa(totaux.valeur)} F</strong></div>
      <div><span>Sous le seuil</span><strong>{sousSeuil.length}</strong></div>
    </div>
    <table class="doc-table">
      <thead>
        <tr><th>Produit</th><th class="nb">Dépôt</th><th class="nb">Boutique (bt)</th><th class="nb">Total (bt)</th><th class="nb">Total</th><th class="nb">Prix</th><th class="nb">Valeur (F)</th></tr>
      </thead>
      <tbody>
        {#each filtrees as l (l.produit_id)}
          <tr>
            <td>{l.designation}{#if l.alerte_depot || l.alerte_boutique}&nbsp;<b class="rouge">▲ seuil</b>{/if}</td>
            <td class="nb" class:rouge={l.alerte_depot}>{l.depot_court}</td>
            <td class="nb" class:rouge={l.alerte_boutique}>{entier(l.boutique)}</td>
            <td class="nb"><strong>{entier(l.total)}</strong></td>
            <td class="nb">{l.total_court}</td>
            <td class="nb">{l.prix === null ? '—' : fcfa(l.prix)}</td>
            <td class="nb">{fcfa(l.valeur)}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr><td>Total</td><td class="nb">{entier(totaux.depot)} bt</td><td class="nb">{entier(totaux.boutique)}</td><td class="nb">{entier(totaux.total)}</td><td></td><td></td><td class="nb">{fcfa(totaux.valeur)}</td></tr>
      </tfoot>
    </table>
    {#if sousSeuil.length}
      <h2 class="doc-section">Produits sous le seuil d’alerte</h2>
      <p class="doc-note">{sousSeuil.map((l) => `${l.designation} (${l.alerte_depot ? 'dépôt ' + l.depot_court : ''}${l.alerte_depot && l.alerte_boutique ? ', ' : ''}${l.alerte_boutique ? 'boutique ' + l.boutique + ' bt' : ''})`).join(' · ')}</p>
    {/if}
  </Apercu>
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
