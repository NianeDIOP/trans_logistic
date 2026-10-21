<script lang="ts">
  import { onMount } from 'svelte'
  import { Printer } from '@lucide/svelte'
  import Apercu from '../../composants/Apercu.svelte'
  import SensEntree from '../../composants/SensEntree.svelte'
  import { grille } from '../../lib/clavier'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import { dateCourte, enConditionnements, entier, lireEntier, valeur } from '../../lib/format'
  import type { LigneSituation, Produit } from '../../lib/types'

  // EF-22 : comptage physique ; les écarts deviennent des mouvements d'inventaire.
  let produits = $state<Produit[]>([])
  let situation = $state<LigneSituation[]>([])
  let lieu = $state<'depot' | 'boutique'>('depot')
  let date = $state(global.date)
  let notes = $state('')
  let comptes = $state<Record<number, { cond: string; bt: string }>>({})
  let enCours = $state(false)
  let feuille = $state(false)
  // Rapport d'écarts du dernier inventaire enregistré (chapitre 9).
  let rapport = $state<{ lieu: string; date: string; notes: string; lignes: { nom: string; theorique: number; compte: number; ecart: number }[] } | null>(null)
  let rapportOuvert = $state(false)

  async function charger() {
    situation = await appel<LigneSituation[]>('situation', { date })
  }

  onMount(async () => {
    produits = await appel<Produit[]>('produits_lister', { inclureInactifs: false, date: global.date })
    comptes = Object.fromEntries(produits.map((p) => [p.id, { cond: '', bt: '' }]))
    await charger()
  })

  const theorique = (id: number) => {
    const s = situation.find((x) => x.produit_id === id)
    return s ? (lieu === 'depot' ? s.depot : s.boutique) : 0
  }
  const saisi = (id: number) => (comptes[id]?.cond ?? '') !== '' || (comptes[id]?.bt ?? '') !== ''
  const compte = (p: Produit) => (lieu === 'depot' ? valeur(comptes[p.id].cond) * p.bt_par_conditionnement : 0) + valeur(comptes[p.id].bt)
  const nbSaisis = $derived(produits.filter((p) => comptes[p.id] && saisi(p.id)).length)

  async function enregistrer() {
    enCours = true
    try {
      const lignes: [number, number][] = []
      for (const p of produits) {
        if (!saisi(p.id)) continue
        const n = compte(p)
        if (Number.isNaN(n) || n < 0 || [comptes[p.id].cond, comptes[p.id].bt].some((v) => Number.isNaN(lireEntier(v) ?? 0))) {
          throw new Error(`${p.designation} : quantité comptée invalide.`)
        }
        lignes.push([p.id, n])
      }
      if (!lignes.length) throw new Error('Aucune quantité comptée.')
      const ecarts = await appel<[number, number][]>('inventaire_enregistrer', { date, lieu, comptes: lignes, notes: notes || 'Inventaire' })
      rapport = {
        lieu,
        date,
        notes: notes || 'Inventaire',
        lignes: lignes.map(([id, compte]) => {
          const e = ecarts.find(([pid]) => pid === id)?.[1] ?? 0
          return { nom: produits.find((p) => p.id === id)!.designation, theorique: compte - e, compte, ecart: e }
        })
      }
      const nb = ecarts.filter(([, e]) => e !== 0).length
      notifier(nb ? `Inventaire enregistré : ${nb} écart(s) corrigé(s).` : 'Inventaire enregistré : aucun écart.')
      comptes = Object.fromEntries(produits.map((p) => [p.id, { cond: '', bt: '' }]))
      await charger()
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    } finally {
      enCours = false
    }
  }
</script>

<section class="barre">
  <div class="segments" role="group" aria-label="Lieu">
    <button class:actif={lieu === 'depot'} onclick={() => (lieu = 'depot')}>Dépôt</button>
    <button class:actif={lieu === 'boutique'} onclick={() => (lieu = 'boutique')}>Boutique</button>
  </div>
  <label class="champ"><span>Date du comptage</span><input class="saisie" type="date" bind:value={date} onchange={charger} /></label>
  <label class="champ motif"><span>Motif</span><input class="saisie" bind:value={notes} placeholder="ex. Inventaire de fin de mois" /></label>
  <button class="btn btn-f" onclick={() => (feuille = true)}><Printer size={17} /> Feuille de comptage</button>
  {#if rapport}<button class="btn btn-f" onclick={() => (rapportOuvert = true)}><Printer size={17} /> Rapport d’écarts</button>{/if}
  <button class="btn btn-p" disabled={enCours || nbSaisis === 0} onclick={enregistrer}>Enregistrer ({nbSaisis})</button>
</section>

{#if feuille}
  <Apercu titre="Feuille d’inventaire — {lieu === 'depot' ? 'Dépôt' : 'Boutique'}" periode="Comptage du {dateCourte(date)}" onfermer={() => (feuille = false)}>
    <table class="doc-table a-remplir">
      <thead>
        <tr>
          <th style="width: 5%">N°</th>
          <th style="width: 37%">Produit</th>
          {#if lieu === 'depot'}<th style="width: 19%">Conditionnements</th>{/if}
          <th style="width: 19%">Bouteilles</th>
          <th>Observations</th>
        </tr>
      </thead>
      <tbody>
        {#each produits as p, i (p.id)}
          <tr>
            <td class="nb">{i + 1}</td>
            <td><strong>{p.designation}</strong>{#if lieu === 'depot'} <small>({p.bt_par_conditionnement} bt par {p.conditionnement})</small>{/if}</td>
            {#if lieu === 'depot'}<td></td>{/if}
            <td></td>
            <td></td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="doc-note">Le stock théorique n’est pas indiqué : comptez ce qui est réellement présent, puis saisissez les quantités dans Dépôt → Inventaire.</p>
    <div class="doc-signatures"><div>Compté par</div><div>Vérifié par</div></div>
  </Apercu>
{/if}

{#if rapportOuvert && rapport}
  {@const r = rapport}
  <Apercu titre="Rapport d’inventaire — {r.lieu === 'depot' ? 'Dépôt' : 'Boutique'}" periode="Comptage du {dateCourte(r.date)} · {r.notes}" onfermer={() => (rapportOuvert = false)}>
    <div class="doc-resume">
      <div><span>Produits comptés</span><strong>{r.lignes.length}</strong></div>
      <div><span>Avec écart</span><strong>{r.lignes.filter((l) => l.ecart).length}</strong></div>
      <div><span>Manquant</span><strong class="rouge">{entier(r.lignes.reduce((t, l) => t + Math.min(0, l.ecart), 0))} bt</strong></div>
      <div><span>Excédent</span><strong>+{entier(r.lignes.reduce((t, l) => t + Math.max(0, l.ecart), 0))} bt</strong></div>
    </div>
    <table class="doc-table">
      <thead><tr><th>Produit</th><th class="nb">Théorique (bt)</th><th class="nb">Compté (bt)</th><th class="nb">Écart (bt)</th></tr></thead>
      <tbody>
        {#each r.lignes as l (l.nom)}
          <tr><td>{l.nom}</td><td class="nb">{entier(l.theorique)}</td><td class="nb">{entier(l.compte)}</td><td class="nb" class:rouge={l.ecart < 0} class:vert={l.ecart > 0}>{l.ecart > 0 ? '+' : ''}{entier(l.ecart)}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="doc-note">Les écarts ont été enregistrés comme mouvements d’inventaire : le stock affiché correspond désormais au comptage.</p>
    <div class="doc-signatures"><div>Compté par</div><div>Vérifié par</div></div>
  </Apercu>
{/if}
<div class="aide">
  <p class="discret">Ne remplissez que les produits comptés. L’écart (compté − théorique) est enregistré comme mouvement d’inventaire.</p>
  <SensEntree />
</div>

<section class="carte" style="padding: 4px 6px" use:grille>
  <table class="tableau">
    <thead>
      <tr>
        <th>Produit</th>
        <th class="nb">Théorique</th>
        {#if lieu === 'depot'}<th class="nb">Compté — conditionnements</th>{/if}
        <th class="nb">Compté — bouteilles</th>
        <th class="nb">Écart (bt)</th>
      </tr>
    </thead>
    <tbody>
      {#each produits as p (p.id)}
        {#if comptes[p.id]}
          {@const ecart = saisi(p.id) ? compte(p) - theorique(p.id) : null}
          <tr>
            <td><strong>{p.designation}</strong></td>
            <td class="nb discret">
              {lieu === 'depot' ? enConditionnements(theorique(p.id), p.bt_par_conditionnement, p.conditionnement, p.conditionnement_pluriel) : `${entier(theorique(p.id))} bt`}
            </td>
            {#if lieu === 'depot'}
              <td class="nb"><input class="saisie nombre petite" inputmode="numeric" data-col="cond" bind:value={comptes[p.id].cond} /></td>
            {/if}
            <td class="nb"><input class="saisie nombre petite" inputmode="numeric" data-col="bt" bind:value={comptes[p.id].bt} /></td>
            <td class="nb" class:negatif={(ecart ?? 0) < 0} class:positif={(ecart ?? 0) > 0}>
              {ecart === null || Number.isNaN(ecart) ? '—' : ecart > 0 ? `+${entier(ecart)}` : entier(ecart)}
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</section>

<style>
  .barre {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 8px;
  }

  .motif {
    flex: 1;
  }

  .aide {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }

  .segments {
    display: inline-flex;
    border: 1px solid var(--filet);
    background: var(--carte);
  }

  .segments button {
    height: 38px;
    padding: 0 18px;
    border: 0;
    background: none;
    font-weight: 700;
    color: var(--texte-2);
    cursor: pointer;
  }

  .segments button.actif {
    background: var(--p);
    color: var(--sur-p);
  }

  .petite {
    width: 96px;
    height: 32px;
  }

  .negatif {
    color: var(--danger);
    font-weight: 800;
  }

  .positif {
    color: var(--ok);
    font-weight: 800;
  }
</style>
