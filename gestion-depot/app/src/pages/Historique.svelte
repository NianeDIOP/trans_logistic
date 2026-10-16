<script lang="ts">
  import { onMount } from 'svelte'
  import { ChevronRight } from '@lucide/svelte'
  import EnTete from '../composants/EnTete.svelte'
  import { appel } from '../lib/api'
  import { aller, global } from '../lib/etat.svelte'
  import { dateCourte, decalerDate, entier, fcfa } from '../lib/format'
  import type { JourneeResume } from '../lib/types'

  // EF-30 : journées enregistrées sur une période, avec ventes, encaissements et écarts de caisse.
  let du = $state(decalerDate(global.date, -30))
  let au = $state(global.date)
  let statut = $state<'' | 'brouillon' | 'validee'>('')
  let journees = $state<JourneeResume[]>([])
  let erreur = $state('')

  async function charger() {
    erreur = ''
    try {
      journees = await appel<JourneeResume[]>('journees_lister', { du, au })
    } catch (e) {
      erreur = (e as Error).message
    }
  }

  onMount(charger)

  function periode(jours: number) {
    au = global.date
    du = decalerDate(global.date, -jours)
    charger()
  }

  const filtrees = $derived(journees.filter((j) => !statut || j.statut === statut))
  const totaux = $derived({
    ventes: filtrees.reduce((s, j) => s + j.total_ventes, 0),
    recu: filtrees.reduce((s, j) => s + j.total_recu, 0),
    depenses: filtrees.reduce((s, j) => s + j.total_depenses, 0),
    ecart: filtrees.reduce((s, j) => s + j.ecart, 0),
    bouteilles: filtrees.reduce((s, j) => s + j.bouteilles_vendues, 0)
  })
  const ecartSigne = (n: number) => (n > 0 ? `+${fcfa(n)}` : fcfa(n))
</script>

<EnTete titre="Historique" sousTitre="Journées enregistrées : ventes calculées, argent reçu, dépenses et écart de caisse. Cliquez sur une journée pour l’ouvrir." />

<section class="barre">
  <label class="champ"><span>Du</span><input class="saisie" type="date" bind:value={du} onchange={charger} /></label>
  <label class="champ"><span>Au</span><input class="saisie" type="date" bind:value={au} onchange={charger} /></label>
  <div class="raccourcis">
    <button class="btn btn-f" onclick={() => periode(7)}>7 jours</button>
    <button class="btn btn-f" onclick={() => periode(30)}>30 jours</button>
    <button class="btn btn-f" onclick={() => periode(365)}>12 mois</button>
  </div>
  <label class="champ">
    <span>Statut</span>
    <select class="saisie" bind:value={statut}>
      <option value="">Tous</option>
      <option value="validee">Validées</option>
      <option value="brouillon">Brouillons</option>
    </select>
  </label>
</section>

<section class="indicateurs">
  <div><span>Journées</span><strong>{filtrees.length}</strong></div>
  <div><span>Ventes</span><strong>{fcfa(totaux.ventes)}</strong></div>
  <div><span>Argent reçu</span><strong>{fcfa(totaux.recu)}</strong></div>
  <div><span>Dépenses</span><strong>{fcfa(totaux.depenses)}</strong></div>
  <div class:negatif={totaux.ecart < 0} class:positif={totaux.ecart > 0}><span>Écart cumulé</span><strong>{ecartSigne(totaux.ecart)}</strong></div>
</section>

{#if erreur}
  <p class="erreur-texte">{erreur}</p>
{:else}
  <section class="carte" style="padding: 4px 6px">
    <table class="tableau">
      <thead>
        <tr>
          <th>Date</th>
          <th>Statut</th>
          <th class="nb">Bouteilles vendues</th>
          <th class="nb">Ventes</th>
          <th class="nb">Reçu</th>
          <th class="nb">Dépenses</th>
          <th class="nb">Écart</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each filtrees as j (j.date)}
          <tr class="ligne" onclick={() => aller('fiche', undefined, j.date)}>
            <td><strong>{dateCourte(j.date)}</strong></td>
            <td>
              <span class="badge" class:badge-neutre={j.statut === 'brouillon'}>{j.statut === 'validee' ? 'Validée' : 'Brouillon'}</span>
            </td>
            <td class="nb">{entier(j.bouteilles_vendues)}</td>
            <td class="nb"><strong>{fcfa(j.total_ventes)}</strong></td>
            <td class="nb">{fcfa(j.total_recu)}</td>
            <td class="nb">{fcfa(j.total_depenses)}</td>
            <td class="nb" class:negatif={j.ecart < 0} class:positif={j.ecart > 0}><strong>{ecartSigne(j.ecart)}</strong></td>
            <td class="nb discret"><ChevronRight size={16} /></td>
          </tr>
        {:else}
          <tr><td colspan="8" class="vide">Aucune journée enregistrée sur la période.</td></tr>
        {/each}
      </tbody>
      {#if filtrees.length}
        <tfoot>
          <tr>
            <td colspan="2"><strong>Total</strong></td>
            <td class="nb"><strong>{entier(totaux.bouteilles)}</strong></td>
            <td class="nb"><strong>{fcfa(totaux.ventes)}</strong></td>
            <td class="nb"><strong>{fcfa(totaux.recu)}</strong></td>
            <td class="nb"><strong>{fcfa(totaux.depenses)}</strong></td>
            <td class="nb" class:negatif={totaux.ecart < 0} class:positif={totaux.ecart > 0}><strong>{ecartSigne(totaux.ecart)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      {/if}
    </table>
  </section>
{/if}

<style>
  .barre {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 16px;
  }

  .raccourcis {
    display: flex;
    gap: 6px;
    margin-right: auto;
  }

  .indicateurs {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0;
    margin-bottom: 16px;
    background: var(--carte);
    border: 1px solid var(--filet);
  }

  .indicateurs div {
    padding: 12px 18px;
    border-left: 3px solid var(--p);
  }

  .indicateurs span {
    display: block;
    color: var(--texte-3);
    font-size: 0.78em;
    font-weight: 700;
    text-transform: uppercase;
  }

  .indicateurs strong {
    font-size: 1.25em;
    font-weight: 800;
  }

  .ligne {
    cursor: pointer;
  }

  .ligne:hover td {
    background: var(--survol);
  }

  tfoot td {
    border-top: 2px solid var(--p);
  }

  .negatif,
  .negatif strong {
    color: var(--danger);
  }

  .positif,
  .positif strong {
    color: var(--ok);
  }
</style>
