<script lang="ts">
  import { onMount } from 'svelte'
  import { ArrowDown, ArrowUp, Pencil, Plus, Search } from '@lucide/svelte'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import { fcfa } from '../../lib/format'
  import type { Conditionnement, Produit } from '../../lib/types'
  import ModaleProduit from './ModaleProduit.svelte'

  let produits = $state<Produit[]>([])
  let conditionnements = $state<Conditionnement[]>([])
  let inactifs = $state(false)
  let recherche = $state('')
  let edition = $state<Produit | 'nouveau' | null>(null)

  async function charger() {
    try {
      ;[produits, conditionnements] = await Promise.all([
        appel<Produit[]>('produits_lister', { inclureInactifs: inactifs, date: global.date }),
        appel<Conditionnement[]>('conditionnements_lister')
      ])
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    }
  }

  onMount(charger)

  async function deplacer(id: number, sens: number) {
    await appel('produit_deplacer', { id, sens })
    await charger()
  }

  const affiches = $derived(produits.filter((p) => !recherche || p.designation.toLowerCase().includes(recherche.toLowerCase())))
  const aConfirmer = $derived(produits.filter((p) => p.actif && p.format_a_confirmer).length)
  const sansPrix = $derived(produits.filter((p) => p.actif && p.prix === null).length)
  const libelleCategorie = (c: string) => global.references?.categories.find((x) => x.code === c)?.libelle ?? c
</script>

<section class="barre">
  <label class="recherche">
    <Search size={17} />
    <input placeholder="Rechercher un produit" bind:value={recherche} />
  </label>
  <label class="case"><input type="checkbox" bind:checked={inactifs} onchange={charger} /> Afficher les produits désactivés</label>
  <span class="espace"></span>
  {#if aConfirmer > 0}<span class="badge badge-alerte">{aConfirmer} format(s) à confirmer</span>{/if}
  {#if sansPrix > 0}<span class="badge badge-danger">{sansPrix} sans prix</span>{/if}
  <button class="btn btn-p" onclick={() => (edition = 'nouveau')}><Plus size={17} /> Nouveau produit</button>
</section>

<section class="carte" style="padding: 6px 8px">
  <table class="tableau">
    <thead>
      <tr>
        <th>N°</th>
        <th>Produit</th>
        <th>Catégorie</th>
        <th>Conditionnement</th>
        <th class="nb">Prix bouteille</th>
        <th class="nb">Seuils (dépôt / boutique)</th>
        <th>Ordre</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each affiches as p, i (p.id)}
        <tr class:inactif={!p.actif}>
          <td class="discret">{i + 1}</td>
          <td>
            <button class="lien-produit" onclick={() => (edition = p)}>{p.designation}</button>
            {#if !p.actif}<span class="badge badge-neutre">désactivé</span>{/if}
          </td>
          <td class="discret">{libelleCategorie(p.categorie)}</td>
          <td>
            {p.conditionnement} de {p.bt_par_conditionnement}
            {#if p.format_a_confirmer}<span class="badge badge-alerte">à confirmer</span>{/if}
          </td>
          <td class="nb">
            {#if p.prix === null}<span class="badge badge-danger">sans prix</span>{:else}<strong>{fcfa(p.prix)}</strong> F{/if}
          </td>
          <td class="nb discret">{p.seuil_depot_conditionnements} {p.conditionnement_pluriel} / {p.seuil_boutique_bt} bt</td>
          <td>
            <button class="btn-icone" title="Monter" disabled={i === 0 || !!recherche} onclick={() => deplacer(p.id, -1)}><ArrowUp size={16} /></button>
            <button class="btn-icone" title="Descendre" disabled={i === affiches.length - 1 || !!recherche} onclick={() => deplacer(p.id, 1)}><ArrowDown size={16} /></button>
          </td>
          <td><button class="btn-icone" title="Modifier" onclick={() => (edition = p)}><Pencil size={16} /></button></td>
        </tr>
      {/each}
    </tbody>
  </table>
</section>
<p class="discret note">L’ordre est celui de la fiche papier du vendeur et de l’écran de saisie. Un produit déjà utilisé n’est jamais supprimé : on le désactive.</p>

{#if edition}
  <ModaleProduit
    produit={edition === 'nouveau' ? null : edition}
    {conditionnements}
    onfermer={() => (edition = null)}
    onenregistre={async () => {
      edition = null
      await charger()
    }}
  />
{/if}

<style>
  .barre {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }

  .espace {
    flex: 1;
  }

  .recherche {
    display: flex;
    width: 300px;
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

  .lien-produit {
    border: 0;
    background: none;
    font-weight: 800;
    cursor: pointer;
  }

  .lien-produit:hover {
    color: var(--a);
  }

  tr.inactif td {
    opacity: 0.55;
  }

  td .badge {
    margin-left: 6px;
  }

  .note {
    margin-top: 12px;
  }
</style>
