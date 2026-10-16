<script lang="ts">
  import { onMount } from 'svelte'
  import { TriangleAlert, ArrowRight, ClipboardList } from '@lucide/svelte'
  import Histogramme from '../composants/Histogramme.svelte'
  import { appel } from '../lib/api'
  import { aller, global, MODULES } from '../lib/etat.svelte'
  import { dateCourte, dateLongue, entier, fcfa } from '../lib/format'
  import type { Accueil, Cumul, Indicateurs } from '../lib/types'

  let donnees = $state<Accueil | null>(null)
  let indic = $state<Indicateurs | null>(null)
  let erreur = $state('')

  onMount(() => {
    Promise.all([appel<Accueil>('accueil', { date: global.date }), appel<Indicateurs>('indicateurs', { date: global.date })])
      .then(([d, i]) => {
        donnees = d
        indic = i
      })
      .catch((e: Error) => (erreur = e.message))
  })

  // EF-03 : ventes et encaissements du jour, de la semaine et du mois.
  const periodes = $derived<[string, Cumul][]>(indic ? [['Aujourd’hui', indic.jour], ['7 derniers jours', indic.semaine], ['Ce mois', indic.mois]] : [])
  const points = $derived(
    (indic?.serie ?? []).map(([d, v]) => ({ cle: d, libelle: dateCourte(d).slice(0, 5), valeur: v }))
  )
  // ET-12 : rappel hebdomadaire si aucune sauvegarde externe récente.
  const sauvegardeEnRetard = $derived.by(() => {
    const s = global.securite
    if (!s) return false
    if (!s.derniere_sauvegarde_externe) return true
    return Date.parse(s.date_du_jour) - Date.parse(s.derniere_sauvegarde_externe) > 7 * 86_400_000
  })
  const signe = (n: number) => (n > 0 ? `+${fcfa(n)}` : fcfa(n))

  // Les modules (hors Accueil), numérotés : la touche du chiffre les ouvre.
  const modules = MODULES.filter((m) => m.page !== 'accueil')
</script>

<section class="tete">
  <div>
    <p class="jour">{dateLongue(global.date)}</p>
    <h1>{global.identite?.nom_commercial}</h1>
    {#if global.identite?.slogan}<p class="slogan">{global.identite.slogan}</p>{/if}
  </div>
  {#if donnees}
    <dl class="stocks">
      <div><dt>Dépôt</dt><dd>{entier(donnees.bouteilles_depot)} <small>bt</small></dd></div>
      <div><dt>Boutique</dt><dd>{entier(donnees.bouteilles_boutique)} <small>bt</small></dd></div>
      <div><dt>Valeur du stock</dt><dd>{fcfa(donnees.valeur_stock)} <small>F</small></dd></div>
      <div class:alerte={donnees.produits_sous_seuil > 0}>
        <dt>Sous le seuil</dt><dd>{donnees.produits_sous_seuil} <small>/ {donnees.nb_produits}</small></dd>
      </div>
    </dl>
  {/if}
</section>

{#if erreur}
  <p class="erreur-texte">{erreur}</p>
{:else if donnees && (donnees.formats_a_confirmer > 0 || donnees.produits_sans_prix > 0)}
  <section class="config">
    <TriangleAlert size={20} />
    <p>
      <strong>Paramétrage à terminer :</strong>
      {#if donnees.formats_a_confirmer > 0}{donnees.formats_a_confirmer} format(s) à confirmer.{/if}
      {#if donnees.produits_sans_prix > 0}{donnees.produits_sans_prix} produit(s) sans prix.{/if}
    </p>
    <button class="btn btn-s" onclick={() => aller('parametres', 'produits')}>Compléter <ArrowRight size={15} /></button>
  </section>
{/if}

{#if indic && (indic.brouillons.length || indic.derniere_validee !== global.date)}
  <section class="rappel">
    <ClipboardList size={20} />
    <p>
      {#if indic.derniere_validee}Dernière journée validée : <strong>{dateLongue(indic.derniere_validee)}</strong>.{:else}Aucune journée validée pour l’instant.{/if}
      {#if indic.brouillons.length}
        {indic.brouillons.length === 1 ? 'Brouillon en attente' : 'Brouillons en attente'} :
        {#each indic.brouillons as b, k (b)}<button class="lien" onclick={() => aller('fiche', undefined, b)}>{dateCourte(b)}</button>{k < indic.brouillons.length - 1 ? ', ' : '.'}{/each}
      {/if}
    </p>
    <button class="btn btn-s" onclick={() => aller('fiche')}>Fiche du jour <ArrowRight size={15} /></button>
  </section>
{/if}

{#if global.securite && sauvegardeEnRetard}
  <section class="config">
    <TriangleAlert size={20} />
    <p>
      <strong>Sauvegarde :</strong>
      {global.securite.derniere_sauvegarde_externe ? `la dernière copie sur clé USB date du ${dateCourte(global.securite.derniere_sauvegarde_externe)}.` : 'aucune copie n’a encore été faite sur une clé USB.'}
      Une sauvegarde par semaine protège vos données.
    </p>
    <button class="btn btn-s" onclick={() => aller('parametres', 'securite')}>Sauvegarder <ArrowRight size={15} /></button>
  </section>
{/if}

<div class="disposition">
<ol class="liste-modules">
  {#each modules as m, i (m.page)}
    <li>
      <button onclick={() => aller(m.page)}>
        <span class="numero">{i + 1}</span>
        <span class="icone"><m.Icone size={24} strokeWidth={1.8} /></span>
        <span class="textes">
          <strong>{m.titre}</strong>
          <span>{m.description}</span>
        </span>
        <kbd>{i + 1}</kbd>
        <ArrowRight size={18} class="fleche" />
      </button>
    </li>
  {/each}
</ol>

{#if indic}
  <section class="carte tableau-bord">
    <h2>Tableau de bord</h2>
    <div class="periodes">
      {#each periodes as [titre, c] (titre)}
        <div>
          <span class="etiquette">{titre}</span>
          <strong>{fcfa(c.ventes)} F</strong>
          <small>{entier(c.bouteilles)} bt · reçu {fcfa(c.recu)} F</small>
          <small class:negatif={c.ecart < 0} class:positif={c.ecart > 0}>Écart {signe(c.ecart)} F</small>
        </div>
      {/each}
    </div>
    <h3>Ventes des 30 derniers jours</h3>
    <Histogramme {points} hauteur={120} />
    <h3>Meilleurs produits du mois</h3>
    {#if indic.meilleurs.length}
      <ol class="meilleurs">
        {#each indic.meilleurs as m, i (m.designation)}
          <li><span class="rang">{i + 1}</span><span class="nom">{m.designation}</span><span>{entier(m.bouteilles)} bt</span><strong>{fcfa(m.montant)} F</strong></li>
        {/each}
      </ol>
    {:else}
      <p class="discret">Aucune vente validée ce mois-ci.</p>
    {/if}
  </section>
{/if}
</div>
<p class="astuce discret">Astuce : tapez le chiffre d’un module pour l’ouvrir, Échap pour revenir à l’accueil.</p>

<style>
  .tete {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 30px;
    padding-bottom: 22px;
    margin-bottom: 22px;
    border-bottom: 1px solid var(--filet);
  }

  .jour {
    color: var(--a);
    font-weight: 800;
    font-size: 0.8em;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1 {
    font-size: 2.2em;
    line-height: 1.15;
  }

  .slogan {
    color: var(--texte-2);
  }

  .stocks {
    display: flex;
  }

  .stocks div {
    padding: 0 22px;
    border-left: 3px solid var(--p);
  }

  .stocks div.alerte {
    border-left-color: var(--alerte);
  }

  .stocks dt {
    color: var(--texte-3);
    font-size: 0.78em;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .stocks dd {
    font-size: 1.45em;
    font-weight: 800;
  }

  .stocks .alerte dd {
    color: var(--alerte);
  }

  .stocks small {
    font-size: 0.55em;
    color: var(--texte-3);
  }

  .config {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
    padding: 10px 14px;
    background: var(--alerte-pale);
    color: var(--alerte);
  }

  .config p {
    flex: 1;
    color: var(--texte);
  }

  .rappel {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 22px;
    padding: 10px 14px;
    background: var(--p-pale);
    color: var(--p);
  }

  :global(:root[data-mode='sombre']) .rappel {
    color: var(--a);
  }

  .rappel p {
    flex: 1;
    color: var(--texte);
  }

  .lien {
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    font-weight: 700;
    text-decoration: underline;
    cursor: pointer;
  }

  .disposition {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 22px;
    align-items: start;
  }

  .tableau-bord h3 {
    margin: 18px 0 10px;
    font-size: 0.85em;
    color: var(--texte-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .periodes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: 12px;
    border: 1px solid var(--filet);
  }

  .periodes div {
    display: flex;
    flex-direction: column;
    padding: 10px 14px;
    border-left: 3px solid var(--a);
  }

  .periodes .etiquette {
    color: var(--texte-3);
    font-size: 0.75em;
    font-weight: 700;
    text-transform: uppercase;
  }

  .periodes strong {
    font-size: 1.3em;
    font-weight: 800;
  }

  .periodes small {
    color: var(--texte-2);
  }

  .negatif {
    color: var(--danger) !important;
    font-weight: 700;
  }

  .positif {
    color: var(--ok) !important;
    font-weight: 700;
  }

  .meilleurs {
    list-style: none;
  }

  .meilleurs li {
    display: grid;
    grid-template-columns: 28px 1fr auto 110px;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    border-bottom: 1px solid var(--filet);
  }

  .meilleurs strong {
    text-align: right;
  }

  .rang {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    background: var(--p);
    color: var(--sur-p);
    font-size: 0.8em;
    font-weight: 800;
  }

  .liste-modules {
    list-style: none;
    border: 1px solid var(--filet);
    background: var(--carte);
  }

  .liste-modules li + li {
    border-top: 1px solid var(--filet);
  }

  .liste-modules button {
    display: flex;
    align-items: center;
    gap: 18px;
    width: 100%;
    padding: 18px 22px;
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .liste-modules button:hover {
    background: var(--survol);
  }

  .liste-modules button:hover .numero {
    background: var(--a);
    color: var(--p);
  }

  .numero {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    background: var(--p);
    color: var(--sur-p);
    font-size: 1.1em;
    font-weight: 800;
    flex: none;
  }

  .icone {
    color: var(--p);
    flex: none;
  }

  :global(:root[data-mode='sombre']) .icone {
    color: var(--a);
  }

  .textes {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .textes strong {
    font-size: 1.12em;
    font-weight: 800;
  }

  .textes span {
    color: var(--texte-2);
    font-size: 0.92em;
  }

  kbd {
    padding: 2px 8px;
    border: 1px solid var(--filet);
    border-bottom-width: 2px;
    font: inherit;
    font-size: 0.8em;
    font-weight: 700;
    color: var(--texte-3);
  }

  .liste-modules :global(.fleche) {
    color: var(--texte-3);
  }

  .astuce {
    margin-top: 12px;
  }
</style>
