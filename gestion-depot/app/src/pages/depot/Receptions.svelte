<script lang="ts">
  import { onMount } from 'svelte'
  import { Plus } from '@lucide/svelte'
  import Modale from '../../composants/Modale.svelte'
  import TableQuantites from '../../composants/TableQuantites.svelte'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import { dateCourte, decalerDate, entier } from '../../lib/format'
  import { lignesSaisies, saisiesVides } from '../../lib/quantites'
  import type { Fournisseur, OperationDepot, Produit } from '../../lib/types'

  // EF-20 : réception fournisseur au dépôt.
  let liste = $state<OperationDepot[]>([])
  let produits = $state<Produit[]>([])
  let fournisseurs = $state<Fournisseur[]>([])
  let du = $state(decalerDate(global.date, -30))
  let au = $state(global.date)
  let ouverte = $state(false)
  let erreur = $state('')
  let enCours = $state(false)
  let saisie = $state({ date: global.date, fournisseur: '', nouveauFournisseur: '', num_bl: '', notes: '' })
  let quantites = $state<Record<number, { cond: string; bt: string }>>({})

  async function charger() {
    liste = await appel<OperationDepot[]>('receptions_lister', { du, au })
  }

  onMount(async () => {
    ;[produits, fournisseurs] = await Promise.all([
      appel<Produit[]>('produits_lister', { inclureInactifs: false, date: global.date }),
      appel<Fournisseur[]>('fournisseurs_lister')
    ])
    await charger()
  })

  function nouvelle() {
    saisie = { date: global.date, fournisseur: '', nouveauFournisseur: '', num_bl: '', notes: '' }
    quantites = saisiesVides(produits)
    erreur = ''
    ouverte = true
  }

  async function enregistrer() {
    erreur = ''
    enCours = true
    try {
      const lignes = lignesSaisies(quantites)
      let fournisseurId: number | null = saisie.fournisseur && saisie.fournisseur !== 'nouveau' ? Number(saisie.fournisseur) : null
      if (saisie.fournisseur === 'nouveau') {
        fournisseurId = await appel<number>('fournisseur_ajouter', { nom: saisie.nouveauFournisseur, telephone: '' })
        fournisseurs = await appel<Fournisseur[]>('fournisseurs_lister')
      }
      await appel('reception_enregistrer', {
        reception: { date: saisie.date, fournisseur_id: fournisseurId, num_bl: saisie.num_bl, notes: saisie.notes, lignes }
      })
      notifier('Réception enregistrée : le stock du dépôt est à jour.')
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
  <span class="espace"></span>
  <button class="btn btn-p" onclick={nouvelle}><Plus size={17} /> Nouvelle réception</button>
</section>

<section class="carte" style="padding: 4px 6px">
  <table class="tableau">
    <thead><tr><th>Date</th><th>Fournisseur</th><th>N° BL</th><th>Produits reçus</th><th class="nb">Bouteilles</th></tr></thead>
    <tbody>
      {#each liste as r (r.id)}
        <tr>
          <td>{dateCourte(r.date)}</td>
          <td>{r.origine || '—'}</td>
          <td class="bl">{r.reference || '—'}</td>
          <td class="detail">{r.lignes.map((l) => `${l.designation} : ${l.quantite}`).join(' · ')}</td>
          <td class="nb"><strong>{entier(r.bouteilles)}</strong></td>
        </tr>
      {:else}
        <tr><td colspan="5" class="vide">Aucune réception sur la période.</td></tr>
      {/each}
    </tbody>
  </table>
</section>

{#if ouverte}
  <Modale titre="Nouvelle réception" sousTitre="Livraison du fournisseur, saisie en conditionnements et bouteilles isolées" largeur={860} onfermer={() => (ouverte = false)} onvalider={() => !enCours && enregistrer()}>
    <div class="grille-entete">
      <label class="champ"><span>Date</span><input class="saisie" type="date" bind:value={saisie.date} /></label>
      <label class="champ">
        <span>Fournisseur</span>
        <select class="saisie" bind:value={saisie.fournisseur}>
          <option value="">— Non précisé —</option>
          {#each fournisseurs as f (f.id)}<option value={String(f.id)}>{f.nom}</option>{/each}
          <option value="nouveau">+ Nouveau fournisseur…</option>
        </select>
      </label>
      {#if saisie.fournisseur === 'nouveau'}
        <label class="champ"><span>Nom du fournisseur</span><input class="saisie" bind:value={saisie.nouveauFournisseur} /></label>
      {/if}
      <label class="champ"><span>N° de bon de livraison</span><input class="saisie" bind:value={saisie.num_bl} /></label>
    </div>
    <TableQuantites {produits} bind:saisies={quantites} />
    {#if erreur}<p class="erreur-texte" style="margin-top: 10px">{erreur}</p>{/if}
    {#snippet pied()}
      <button class="btn btn-f" onclick={() => (ouverte = false)}>Annuler</button>
      <button class="btn btn-p" disabled={enCours} onclick={enregistrer}>Enregistrer la réception <kbd>Ctrl+Entrée</kbd></button>
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

  .espace {
    flex: 1;
  }

  .bl {
    white-space: nowrap;
  }

  .detail {
    color: var(--texte-2);
    font-size: 0.9em;
  }

  .grille-entete {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 14px;
  }
</style>
