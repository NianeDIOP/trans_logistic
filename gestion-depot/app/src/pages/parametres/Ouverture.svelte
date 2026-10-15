<script lang="ts">
  import { onMount } from 'svelte'
  import { Lock } from '@lucide/svelte'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import { dateCourte, entier, lireEntier } from '../../lib/format'
  import type { Ouverture, Produit } from '../../lib/types'

  // EF-42 : stock compté à la mise en service. Rejouable tant qu'aucune journée n'est validée.
  interface Ligne { produit: Produit; depotCond: string; depotBt: string; boutique: string }

  let lignes = $state<Ligne[]>([])
  let possible = $state(true)
  let date = $state(global.date)
  let dejaSaisi = $state<string | null>(null)
  let enCours = $state(false)

  onMount(async () => {
    const [produits, ouverture, ok] = await Promise.all([
      appel<Produit[]>('produits_lister', { inclureInactifs: false, date: global.date }),
      appel<Ouverture>('stock_ouverture_lire'),
      appel<boolean>('stock_ouverture_possible')
    ])
    possible = ok
    dejaSaisi = ouverture.date
    if (ouverture.date) date = ouverture.date
    lignes = produits.map((p) => {
      const o = ouverture.lignes.find((l) => l[0] === p.id)
      const depot = o?.[1] ?? 0
      return {
        produit: p,
        depotCond: depot ? String(Math.floor(depot / p.bt_par_conditionnement)) : '',
        depotBt: depot % p.bt_par_conditionnement ? String(depot % p.bt_par_conditionnement) : '',
        boutique: o?.[2] ? String(o[2]) : ''
      }
    })
  })

  const val = (s: string) => {
    const n = lireEntier(s)
    return n === null ? 0 : n
  }
  const invalide = (s: string) => {
    const n = lireEntier(s)
    return n !== null && (Number.isNaN(n) || n < 0)
  }
  const totalDepot = $derived(lignes.reduce((t, l) => t + val(l.depotCond) * l.produit.bt_par_conditionnement + val(l.depotBt), 0))
  const totalBoutique = $derived(lignes.reduce((t, l) => t + val(l.boutique), 0))
  const erreurs = $derived(lignes.some((l) => invalide(l.depotCond) || invalide(l.depotBt) || invalide(l.boutique)))

  async function enregistrer() {
    enCours = true
    try {
      await appel('stock_ouverture', {
        date,
        lignes: lignes.map((l) => ({
          produit_id: l.produit.id,
          depot_conditionnements: val(l.depotCond),
          depot_bouteilles: val(l.depotBt),
          boutique_bouteilles: val(l.boutique)
        }))
      })
      dejaSaisi = date
      notifier('Stock d’ouverture enregistré.')
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    } finally {
      enCours = false
    }
  }
</script>

<section class="carte">
  <header class="tete">
    <div>
      <h2>Stock d’ouverture</h2>
      <p class="discret">
        Comptage du dépôt et de la boutique le jour de la mise en service.
        {#if dejaSaisi}Déjà saisi au {dateCourte(dejaSaisi)} : une nouvelle saisie remplace la précédente.{/if}
      </p>
    </div>
    {#if possible}
      <div class="date">
        <label class="champ"><span>Date du comptage</span><input class="saisie" type="date" bind:value={date} /></label>
        <button class="btn btn-p" disabled={erreurs || enCours} onclick={enregistrer}>Enregistrer</button>
      </div>
    {/if}
  </header>

  {#if !possible}
    <p class="verrou"><Lock size={18} /> Une journée est déjà validée : le stock se corrige désormais par un inventaire (module Dépôt).</p>
  {/if}

  <table class="tableau">
    <thead>
      <tr>
        <th>Produit</th>
        <th class="nb">Dépôt — conditionnements</th>
        <th class="nb">Dépôt — bouteilles isolées</th>
        <th class="nb">Boutique — bouteilles</th>
        <th class="nb">Total (bt)</th>
      </tr>
    </thead>
    <tbody>
      {#each lignes as l (l.produit.id)}
        <tr>
          <td><strong>{l.produit.designation}</strong> <span class="discret">({l.produit.conditionnement} de {l.produit.bt_par_conditionnement})</span></td>
          <td class="nb"><input class="saisie nombre petite" class:invalide={invalide(l.depotCond)} inputmode="numeric" bind:value={l.depotCond} disabled={!possible} /></td>
          <td class="nb"><input class="saisie nombre petite" class:invalide={invalide(l.depotBt)} inputmode="numeric" bind:value={l.depotBt} disabled={!possible} /></td>
          <td class="nb"><input class="saisie nombre petite" class:invalide={invalide(l.boutique)} inputmode="numeric" bind:value={l.boutique} disabled={!possible} /></td>
          <td class="nb"><strong>{entier(val(l.depotCond) * l.produit.bt_par_conditionnement + val(l.depotBt) + val(l.boutique))}</strong></td>
        </tr>
      {/each}
    </tbody>
    <tfoot>
      <tr>
        <td>Total</td>
        <td colspan="2" class="nb">{entier(totalDepot)} bt au dépôt</td>
        <td class="nb">{entier(totalBoutique)} bt</td>
        <td class="nb">{entier(totalDepot + totalBoutique)}</td>
      </tr>
    </tfoot>
  </table>
</section>

<style>
  .tete {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 20px;
    margin-bottom: 14px;
  }

  .date {
    display: flex;
    align-items: flex-end;
    gap: 10px;
  }

  .petite {
    width: 96px;
    height: 34px;
  }

  .verrou {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding: 10px 14px;
    border-radius: 0;
    background: var(--alerte-pale);
    color: var(--alerte);
    font-weight: 600;
  }
</style>
