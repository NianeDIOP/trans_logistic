<script lang="ts">
  import { onMount } from 'svelte'
  import { Plus } from '@lucide/svelte'
  import Modale from '../../composants/Modale.svelte'
  import TableQuantites from '../../composants/TableQuantites.svelte'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import { dateCourte, decalerDate, entier } from '../../lib/format'
  import { lignesSaisies, saisiesVides } from '../../lib/quantites'
  import type { LigneSituation, OperationDepot, Produit } from '../../lib/types'

  // EF-21 : transfert du dépôt vers la boutique, contrôlé par le stock du dépôt (RG-14).
  let liste = $state<OperationDepot[]>([])
  let produits = $state<Produit[]>([])
  let disponibles = $state<Record<number, number>>({})
  let du = $state(decalerDate(global.date, -30))
  let au = $state(global.date)
  let ouverte = $state(false)
  let erreur = $state('')
  let enCours = $state(false)
  let date = $state(global.date)
  let notes = $state('')
  let quantites = $state<Record<number, { cond: string; bt: string }>>({})

  async function charger() {
    liste = await appel<OperationDepot[]>('alimentations_lister', { du, au })
  }

  onMount(async () => {
    produits = await appel<Produit[]>('produits_lister', { inclureInactifs: false, date: global.date })
    await charger()
  })

  async function nouvelle() {
    const situation = await appel<LigneSituation[]>('situation', { date: global.date })
    disponibles = Object.fromEntries(situation.map((s) => [s.produit_id, s.depot]))
    quantites = saisiesVides(produits)
    date = global.date
    notes = ''
    erreur = ''
    ouverte = true
  }

  async function enregistrer() {
    erreur = ''
    enCours = true
    try {
      await appel('alimentation_enregistrer', { date, lignes: lignesSaisies(quantites), notes })
      notifier('Alimentation enregistrée : dépôt et boutique sont à jour.')
      ouverte = false
      await charger()
    } catch (e) {
      erreur = (e as Error).message
    } finally {
      enCours = false
    }
  }
</script>

<section class="barre">
  <label class="champ"><span>Du</span><input class="saisie" type="date" bind:value={du} onchange={charger} /></label>
  <label class="champ"><span>Au</span><input class="saisie" type="date" bind:value={au} onchange={charger} /></label>
  <p class="discret note">Une alimentation peut aussi être notée directement sur la fiche du jour.</p>
  <button class="btn btn-p" onclick={nouvelle}><Plus size={17} /> Nouvelle alimentation</button>
</section>

<section class="carte" style="padding: 4px 6px">
  <table class="tableau">
    <thead><tr><th>Date</th><th>Origine</th><th>Produits transférés</th><th class="nb">Bouteilles</th></tr></thead>
    <tbody>
      {#each liste as a (a.id)}
        <tr>
          <td>{dateCourte(a.date)}</td>
          <td><span class="badge" class:badge-neutre={a.origine !== 'Fiche du jour'}>{a.origine}</span></td>
          <td class="detail">{a.lignes.map((l) => `${l.designation} : ${l.quantite}`).join(' · ')}</td>
          <td class="nb"><strong>{entier(a.bouteilles)}</strong></td>
        </tr>
      {:else}
        <tr><td colspan="4" class="vide">Aucune alimentation sur la période.</td></tr>
      {/each}
    </tbody>
  </table>
</section>

{#if ouverte}
  <Modale titre="Alimenter la boutique" sousTitre="Conditionnements sortis du dépôt et portés en boutique" largeur={860} onfermer={() => (ouverte = false)} onvalider={() => !enCours && enregistrer()}>
    <div class="grille-entete">
      <label class="champ"><span>Date</span><input class="saisie" type="date" bind:value={date} /></label>
      <label class="champ" style="grid-column: span 2"><span>Note</span><input class="saisie" bind:value={notes} placeholder="Facultatif" /></label>
    </div>
    <TableQuantites {produits} bind:saisies={quantites} {disponibles} />
    {#if erreur}<p class="erreur-texte" style="margin-top: 10px">{erreur}</p>{/if}
    {#snippet pied()}
      <button class="btn btn-f" onclick={() => (ouverte = false)}>Annuler</button>
      <button class="btn btn-p" disabled={enCours} onclick={enregistrer}>Enregistrer l’alimentation <kbd>Ctrl+Entrée</kbd></button>
    {/snippet}
  </Modale>
{/if}

<style>
  .barre {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 14px;
  }

  .note {
    flex: 1;
    align-self: center;
  }

  .detail {
    color: var(--texte-2);
    font-size: 0.9em;
  }

  .grille-entete {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }
</style>
