<script lang="ts">
  import { onMount } from 'svelte'
  import { FileSpreadsheet, Printer, Truck } from '@lucide/svelte'
  import Histogramme from '../../composants/Histogramme.svelte'
  import RapportDoc from '../documents/RapportPeriode.svelte'
  import MouvementsDepot from '../documents/MouvementsDepot.svelte'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import { colonnes, exporterExcel } from '../../lib/excel'
  import { dateCourte, decalerDate, entier, fcfa } from '../../lib/format'
  import type { OperationDepot, RapportPeriode } from '../../lib/types'

  // EF-31 : rapport de période — ventes par produit et par catégorie, encaissements, écarts, dépenses,
  // casse, réceptions et alimentations. Seules les journées validées comptent.
  const debutMois = (d: string) => `${d.slice(0, 8)}01`
  let du = $state(debutMois(global.date))
  let au = $state(global.date)
  let rapport = $state<RapportPeriode | null>(null)
  let erreur = $state('')
  let doc = $state<'' | 'rapport' | 'mouvements'>('')
  let operations = $state<{ receptions: OperationDepot[]; alimentations: OperationDepot[] }>({ receptions: [], alimentations: [] })

  async function charger() {
    erreur = ''
    try {
      rapport = await appel<RapportPeriode>('rapport_periode', { du, au })
    } catch (e) {
      erreur = (e as Error).message
    }
  }
  onMount(charger)

  function periode(type: 'mois' | 'precedent' | '7' | '30') {
    if (type === 'mois') {
      du = debutMois(global.date)
      au = global.date
    } else if (type === 'precedent') {
      au = decalerDate(debutMois(global.date), -1)
      du = debutMois(au)
    } else {
      au = global.date
      du = decalerDate(global.date, -(Number(type) - 1))
    }
    charger()
  }

  async function ouvrirMouvements() {
    try {
      const [receptions, alimentations] = await Promise.all([
        appel<OperationDepot[]>('receptions_lister', { du, au }),
        appel<OperationDepot[]>('alimentations_lister', { du, au })
      ])
      operations = { receptions: receptions.reverse(), alimentations: alimentations.reverse() }
      doc = 'mouvements'
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    }
  }

  const categorie = (c: string) => global.references?.categories.find((x) => x.code === c)?.libelle ?? c
  const periodeTexte = $derived(`Du ${dateCourte(du)} au ${dateCourte(au)}`)
  const maxCategorie = $derived(Math.max(1, ...(rapport?.categories.map((c) => c.montant) ?? [])))
  const signe = (n: number) => (n > 0 ? `+${fcfa(n)}` : fcfa(n))

  /** Jours de la période (validés ou non) pour le graphique ; 0 si pas de fiche validée. */
  const points = $derived.by(() => {
    if (!rapport) return []
    const parJour = new Map(rapport.jours.map((j) => [j.date, j]))
    const liste = []
    for (let d = du; d <= au && liste.length < 400; d = decalerDate(d, 1)) {
      const j = parJour.get(d)
      liste.push({ cle: d, libelle: dateCourte(d).slice(0, 5), valeur: j?.total_ventes ?? 0, detail: j ? `Écart ${signe(j.ecart)} F` : 'Pas de fiche validée' })
    }
    return liste
  })

  async function excel() {
    if (!rapport) return
    const r = rapport
    const [receptions, alimentations] = await Promise.all([
      appel<OperationDepot[]>('receptions_lister', { du, au }),
      appel<OperationDepot[]>('alimentations_lister', { du, au })
    ])
    const ops = (liste: OperationDepot[], type: string) =>
      [...liste].reverse().flatMap((o) => o.lignes.map((l) => [dateCourte(o.date), type, o.origine, o.reference, l.designation, l.bouteilles]))
    exporterExcel(`Rapport ${du} au ${au}`, [
      {
        nom: 'Produits',
        titre: 'Ventes et mouvements par produit',
        sous_titre: periodeTexte,
        colonnes: colonnes(['Produit', 26], ['Catégorie', 12], ['Vendues (bt)', 12], ['Montant', 13], ['Casse (bt)', 10], ['Reçu au dépôt (bt)', 15], ['Transféré en boutique (bt)', 18]),
        lignes: r.produits.map((p) => [p.designation, categorie(p.categorie), p.bouteilles_vendues, p.montant, p.casse, p.recu_depot, p.alimente]),
        total: ['Total', null, r.totaux.bouteilles, r.totaux.ventes, r.casse, r.recu_depot, r.alimente]
      },
      {
        nom: 'Catégories',
        titre: 'Ventes par catégorie',
        sous_titre: periodeTexte,
        colonnes: colonnes(['Catégorie', 16], ['Bouteilles', 12], ['Montant', 14]),
        lignes: r.categories.map((c) => [categorie(c.categorie), c.bouteilles, c.montant]),
        total: ['Total', r.totaux.bouteilles, r.totaux.ventes]
      },
      {
        nom: 'Encaissements',
        titre: 'Encaissements et écarts par jour',
        sous_titre: periodeTexte,
        colonnes: colonnes(['Date', 12], ['Bouteilles vendues', 12], ['Ventes', 12], ['Reçu', 12], ['Dépenses', 12], ['Écart', 12]),
        lignes: r.jours.map((j) => [dateCourte(j.date), j.bouteilles_vendues, j.total_ventes, j.total_recu, j.total_depenses, j.ecart]),
        total: ['Total', r.totaux.bouteilles, r.totaux.ventes, r.totaux.recu, r.totaux.depenses, r.totaux.ecart]
      },
      {
        nom: 'Dépenses',
        titre: 'Dépenses payées avec la caisse',
        sous_titre: periodeTexte,
        colonnes: colonnes(['Libellé', 30], ['Montant', 14]),
        lignes: r.depenses.map(([l, m]) => [l, m]),
        total: ['Total', r.totaux.depenses]
      },
      {
        nom: 'Mouvements du dépôt',
        titre: 'Réceptions et alimentations',
        sous_titre: periodeTexte,
        colonnes: colonnes(['Date', 12], ['Type', 13], ['Origine', 20], ['Référence', 14], ['Produit', 26], ['Bouteilles', 11]),
        lignes: [...ops(receptions, 'Réception'), ...ops(alimentations, 'Alimentation')]
      }
    ])
  }
</script>

<section class="barre">
  <label class="champ"><span>Du</span><input class="saisie" type="date" bind:value={du} onchange={charger} /></label>
  <label class="champ"><span>Au</span><input class="saisie" type="date" bind:value={au} onchange={charger} /></label>
  <div class="raccourcis">
    <button class="btn btn-f" onclick={() => periode('mois')}>Ce mois</button>
    <button class="btn btn-f" onclick={() => periode('precedent')}>Mois dernier</button>
    <button class="btn btn-f" onclick={() => periode('7')}>7 jours</button>
    <button class="btn btn-f" onclick={() => periode('30')}>30 jours</button>
  </div>
  <button class="btn btn-f" disabled={!rapport} onclick={excel}><FileSpreadsheet size={17} /> Excel</button>
  <button class="btn btn-f" disabled={!rapport} onclick={ouvrirMouvements}><Truck size={17} /> Mouvements du dépôt</button>
  <button class="btn btn-s" disabled={!rapport} onclick={() => (doc = 'rapport')}><Printer size={17} /> Imprimer</button>
</section>

{#if erreur}
  <p class="erreur-texte">{erreur}</p>
{:else if rapport}
  {@const r = rapport}
  <section class="indicateurs">
    <div><span>Journées validées</span><strong>{r.totaux.journees}</strong></div>
    <div><span>Ventes</span><strong>{fcfa(r.totaux.ventes)}</strong></div>
    <div><span>Argent reçu</span><strong>{fcfa(r.totaux.recu)}</strong></div>
    <div><span>Dépenses</span><strong>{fcfa(r.totaux.depenses)}</strong></div>
    <div class:negatif={r.totaux.ecart < 0} class:positif={r.totaux.ecart > 0}><span>Écart cumulé</span><strong>{signe(r.totaux.ecart)}</strong></div>
    <div><span>Bouteilles vendues</span><strong>{entier(r.totaux.bouteilles)}</strong></div>
    <div class:negatif={r.casse > 0}><span>Casse</span><strong>{entier(r.casse)} bt</strong></div>
  </section>

  <section class="carte">
    <h2>Ventes par jour</h2>
    <p class="discret">Montant des ventes des journées validées (F). Survolez une barre pour le détail.</p>
    <div style="margin-top: 26px"><Histogramme {points} /></div>
  </section>

  <div class="deux">
    <section class="carte">
      <h2>Ventes par catégorie</h2>
      {#each r.categories as c (c.categorie)}
        <div class="cat">
          <span class="nom">{categorie(c.categorie)}</span>
          <span class="piste"><i style:width="{(c.montant / maxCategorie) * 100}%"></i></span>
          <span class="nb"><strong>{fcfa(c.montant)} F</strong> <small>{entier(c.bouteilles)} bt</small></span>
        </div>
      {:else}
        <p class="vide">Aucune vente sur la période.</p>
      {/each}
    </section>
    <section class="carte">
      <h2>Dépenses payées avec la caisse</h2>
      <table class="tableau">
        <tbody>
          {#each r.depenses as [libelle, montant] (libelle)}
            <tr><td>{libelle}</td><td class="nb">{fcfa(montant)} F</td></tr>
          {:else}
            <tr><td class="vide">Aucune dépense.</td></tr>
          {/each}
        </tbody>
        {#if r.depenses.length}<tfoot><tr><td>Total</td><td class="nb">{fcfa(r.totaux.depenses)} F</td></tr></tfoot>{/if}
      </table>
    </section>
  </div>

  <section class="carte" style="padding: 4px 6px">
    <table class="tableau">
      <thead>
        <tr><th>Produit</th><th>Catégorie</th><th class="nb">Vendues (bt)</th><th class="nb">Montant</th><th class="nb">Casse</th><th class="nb">Reçu au dépôt</th><th class="nb">Transféré</th></tr>
      </thead>
      <tbody>
        {#each r.produits as p (p.produit_id)}
          <tr>
            <td><strong>{p.designation}</strong></td>
            <td class="discret">{categorie(p.categorie)}</td>
            <td class="nb">{entier(p.bouteilles_vendues)}</td>
            <td class="nb"><strong>{fcfa(p.montant)}</strong></td>
            <td class="nb" class:negatif={p.casse > 0}>{p.casse || '—'}</td>
            <td class="nb">{p.recu_depot || '—'}</td>
            <td class="nb">{p.alimente || '—'}</td>
          </tr>
        {:else}
          <tr><td colspan="7" class="vide">Aucune activité sur la période.</td></tr>
        {/each}
      </tbody>
      {#if r.produits.length}
        <tfoot>
          <tr><td colspan="2">Total</td><td class="nb">{entier(r.totaux.bouteilles)}</td><td class="nb">{fcfa(r.totaux.ventes)}</td><td class="nb">{r.casse}</td><td class="nb">{entier(r.recu_depot)}</td><td class="nb">{entier(r.alimente)}</td></tr>
        </tfoot>
      {/if}
    </table>
  </section>

  {#if doc === 'rapport'}
    <RapportDoc rapport={r} onfermer={() => (doc = '')} />
  {:else if doc === 'mouvements'}
    <MouvementsDepot rapport={r} receptions={operations.receptions} alimentations={operations.alimentations} onfermer={() => (doc = '')} />
  {/if}
{/if}

<style>
  .barre {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .raccourcis {
    display: flex;
    gap: 6px;
    margin-right: auto;
  }

  .indicateurs {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    margin-bottom: 16px;
    background: var(--carte);
    border: 1px solid var(--filet);
  }

  .indicateurs div {
    padding: 10px 14px;
    border-left: 3px solid var(--p);
  }

  .indicateurs span {
    display: block;
    color: var(--texte-3);
    font-size: 0.74em;
    font-weight: 700;
    text-transform: uppercase;
  }

  .indicateurs strong {
    font-size: 1.15em;
    font-weight: 800;
  }

  .negatif strong,
  td.negatif {
    color: var(--danger);
  }

  .positif strong {
    color: var(--ok);
  }

  .carte {
    margin-bottom: 16px;
  }

  .deux {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .cat {
    display: grid;
    grid-template-columns: 90px 1fr 170px;
    align-items: center;
    gap: 12px;
    padding: 6px 0;
  }

  .piste {
    height: 12px;
    background: var(--survol);
  }

  .piste i {
    display: block;
    height: 100%;
    background: var(--p);
  }

  :global(:root[data-mode='sombre']) .piste i {
    background: var(--a);
  }

  .cat .nb {
    text-align: right;
  }

  .cat small {
    color: var(--texte-3);
  }
</style>
