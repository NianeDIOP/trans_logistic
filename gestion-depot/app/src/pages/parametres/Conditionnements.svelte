<script lang="ts">
  import { onMount } from 'svelte'
  import { Pencil, Plus, Star } from '@lucide/svelte'
  import Modale from '../../composants/Modale.svelte'
  import { appel } from '../../lib/api'
  import { notifier } from '../../lib/etat.svelte'
  import type { Conditionnement, ConditionnementSaisie } from '../../lib/types'

  // RG-05 : le nom du conditionnement (caisse, carton, pack…) est paramétrable.
  let liste = $state<Conditionnement[]>([])
  let edition = $state<{ id: number | null; saisie: ConditionnementSaisie } | null>(null)
  let erreur = $state('')

  async function charger() {
    liste = await appel<Conditionnement[]>('conditionnements_lister')
  }
  onMount(charger)

  async function definirDefaut(c: Conditionnement) {
    try {
      await appel('conditionnement_defaut', { id: c.id })
      notifier(`« ${c.singulier} » est désormais le conditionnement par défaut.`)
      await charger()
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    }
  }

  async function enregistrer(e: Event) {
    e.preventDefault()
    if (!edition) return
    erreur = ''
    try {
      if (edition.id === null) await appel('conditionnement_ajouter', { saisie: edition.saisie })
      else await appel('conditionnement_modifier', { id: edition.id, saisie: edition.saisie })
      notifier('Conditionnement enregistré.')
      edition = null
      await charger()
    } catch (err) {
      erreur = (err as Error).message
    }
  }
</script>

<div class="disposition">
  <section class="carte">
    <header class="tete">
      <div>
        <h2>Conditionnements</h2>
        <p class="discret">Nom utilisé partout pour les livraisons et le stock du dépôt : saisie, écrans, impressions.</p>
      </div>
      <button class="btn btn-p" onclick={() => (edition = { id: null, saisie: { singulier: '', pluriel: '', abreviation: '' } })}>
        <Plus size={17} /> Ajouter
      </button>
    </header>
    <table class="tableau">
      <thead><tr><th>Singulier</th><th>Pluriel</th><th>Abréviation</th><th class="nb">Produits dédiés</th><th></th></tr></thead>
      <tbody>
        {#each liste as c (c.id)}
          <tr>
            <td>
              <strong>{c.singulier}</strong>
              {#if c.par_defaut}<span class="badge"><Star size={12} /> par défaut</span>{/if}
            </td>
            <td>{c.pluriel}</td>
            <td>{c.abreviation}</td>
            <td class="nb">{c.nb_produits}</td>
            <td class="nb actions-ligne">
              {#if !c.par_defaut}<button class="btn btn-f" onclick={() => definirDefaut(c)}>Par défaut</button>{/if}
              <button class="btn-icone" title="Modifier" onclick={() => (edition = { id: c.id, saisie: { singulier: c.singulier, pluriel: c.pluriel, abreviation: c.abreviation } })}>
                <Pencil size={16} />
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <aside class="carte aide">
    <h3>Comment ça marche</h3>
    <p>Le conditionnement <strong>par défaut</strong> s’applique à tous les produits, sauf ceux pour lesquels un autre est choisi (Produits et prix).</p>
    <p>Changer un nom ne modifie aucune quantité : le stock reste compté en bouteilles, seul l’affichage change. Exemple : « 30 caisses + 5 bouteilles » ou « 30 cartons + 5 bouteilles ».</p>
  </aside>
</div>

{#if edition}
  <Modale titre={edition.id === null ? 'Nouveau conditionnement' : 'Modifier le conditionnement'} largeur={480} onfermer={() => (edition = null)}>
    <form id="form-cond" onsubmit={enregistrer} class="grille-3">
      <label class="champ"><span>Singulier</span><input class="saisie" bind:value={edition.saisie.singulier} placeholder="caisse" /></label>
      <label class="champ"><span>Pluriel</span><input class="saisie" bind:value={edition.saisie.pluriel} placeholder="caisses" /></label>
      <label class="champ"><span>Abréviation</span><input class="saisie" bind:value={edition.saisie.abreviation} placeholder="cs" /></label>
    </form>
    {#if erreur}<p class="erreur-texte" style="margin-top: 10px">{erreur}</p>{/if}
    {#snippet pied()}
      <button class="btn btn-f" onclick={() => (edition = null)}>Annuler</button>
      <button class="btn btn-p" form="form-cond">Enregistrer</button>
    {/snippet}
  </Modale>
{/if}

<style>
  .disposition {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 20px;
    align-items: start;
  }

  .tete {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 12px;
  }

  td .badge {
    margin-left: 8px;
  }

  .actions-ligne {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
  }

  .aide p {
    margin-top: 10px;
    color: var(--texte-2);
  }
</style>
