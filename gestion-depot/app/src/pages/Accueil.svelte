<script lang="ts">
  import { onMount } from 'svelte'
  import { TriangleAlert, ArrowRight } from '@lucide/svelte'
  import { appel } from '../lib/api'
  import { aller, global, MODULES } from '../lib/etat.svelte'
  import { dateLongue, entier, fcfa } from '../lib/format'
  import type { Accueil } from '../lib/types'

  let donnees = $state<Accueil | null>(null)
  let erreur = $state('')

  onMount(() => {
    appel<Accueil>('accueil', { date: global.date })
      .then((d) => (donnees = d))
      .catch((e: Error) => (erreur = e.message))
  })

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
