<script lang="ts">
  import { Check, Moon, Sun } from '@lucide/svelte'
  import { appel } from '../../lib/api'
  import { appliquerTheme, global, notifier } from '../../lib/etat.svelte'
  import type { Presentation, Theme } from '../../lib/types'

  // EF-52 à EF-55 : thème de l'interface, en-têtes, modèles et thèmes des documents.
  let p = $state<Presentation>(structuredClone($state.snapshot(global.presentation!)))
  let enCours = $state(false)
  const refs = global.references!

  const modifie = $derived(JSON.stringify(p) !== JSON.stringify(global.presentation))
  const themeDoc = $derived(refs.themes.find((t) => t.code === p.theme_document) ?? refs.themes[0])

  // Aperçu immédiat du thème de l'interface (annulé si on quitte sans enregistrer).
  $effect(() => {
    appliquerTheme(p, refs)
    return () => appliquerTheme(global.presentation!, refs)
  })

  function basculerElement(code: string) {
    p.entete_elements = p.entete_elements.includes(code) ? p.entete_elements.filter((e) => e !== code) : [...p.entete_elements, code]
  }

  async function enregistrer() {
    enCours = true
    try {
      global.presentation = await appel<Presentation>('presentation_modifier', { presentation: p })
      p = structuredClone($state.snapshot(global.presentation))
      notifier('Apparence enregistrée.')
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    } finally {
      enCours = false
    }
  }

  const has = (code: string) => p.entete_elements.includes(code)
  const fondPastille = (t: Theme) => `linear-gradient(135deg, ${t.principal} 0 58%, ${t.accent} 58% 100%)`
</script>

<div class="barre">
  <p class="discret">Les changements de l’interface s’affichent tout de suite ; ils sont conservés une fois enregistrés.</p>
  <button class="btn btn-f" disabled={!modifie} onclick={() => (p = structuredClone($state.snapshot(global.presentation!)))}>Annuler</button>
  <button class="btn btn-p" disabled={!modifie || enCours} onclick={enregistrer}>Enregistrer</button>
</div>

<div class="disposition">
  <div class="colonne">
    <section class="carte">
      <h2>Interface</h2>
      <h3 class="sous">Couleurs</h3>
      <div class="pastilles">
        {#each refs.themes as t (t.code)}
          <button class="pastille" class:choisie={p.theme_interface === t.code} title={t.nom} onclick={() => (p.theme_interface = t.code)}>
            <span style:background={fondPastille(t)}>{#if p.theme_interface === t.code}<Check size={16} color="#fff" />{/if}</span>
            {t.nom}
          </button>
        {/each}
      </div>
      <div class="options">
        <div class="segments" role="group" aria-label="Mode">
          <button class:actif={!p.mode_sombre} onclick={() => (p.mode_sombre = false)}><Sun size={16} /> Clair</button>
          <button class:actif={p.mode_sombre} onclick={() => (p.mode_sombre = true)}><Moon size={16} /> Sombre</button>
        </div>
        <label class="case"><input type="checkbox" bind:checked={p.grand_texte} /> Grand texte</label>
      </div>
    </section>

    <section class="carte">
      <h2>Documents imprimés</h2>
      <h3 class="sous">Mise en page</h3>
      <div class="modeles">
        {#each refs.modeles as m (m.code)}
          <button class="modele" class:choisi={p.modele_document === m.code} onclick={() => (p.modele_document = m.code)}>
            <strong>{m.nom}</strong>
            <span class="discret">{m.description}</span>
          </button>
        {/each}
      </div>
      <h3 class="sous">Couleurs des documents</h3>
      <div class="pastilles">
        {#each refs.themes as t (t.code)}
          <button class="pastille" class:choisie={p.theme_document === t.code} title={t.nom} onclick={() => (p.theme_document = t.code)}>
            <span style:background={fondPastille(t)}>{#if p.theme_document === t.code}<Check size={16} color="#fff" />{/if}</span>
            {t.nom}
          </button>
        {/each}
      </div>
      <h3 class="sous">En-tête</h3>
      <div class="entete-options">
        <label class="champ">
          <span>Position du logo</span>
          <select class="saisie" bind:value={p.entete_logo}>
            <option value="gauche">À gauche</option>
            <option value="centre">Au centre</option>
            <option value="droite">À droite</option>
            <option value="aucun">Pas de logo</option>
          </select>
        </label>
        <div class="champ">
          <span>Éléments affichés</span>
          <div class="cases">
            {#each refs.elements_entete as e (e.code)}
              <label class="case"><input type="checkbox" checked={has(e.code)} onchange={() => basculerElement(e.code)} /> {e.libelle}</label>
            {/each}
          </div>
        </div>
      </div>
      <label class="champ" style="margin-top: 14px">
        <span>Pied de page</span>
        <textarea class="saisie" bind:value={p.pied_page} placeholder="Horaires, remerciements, mentions…"></textarea>
      </label>
    </section>
  </div>

  <section class="carte apercu-carte">
    <h3>Aperçu de l’en-tête</h3>
    <div
      class="feuille modele-{p.modele_document}"
      style:--dp={themeDoc.principal}
      style:--da={themeDoc.accent}
    >
      <div class="doc-entete logo-{p.entete_logo}">
        {#if p.entete_logo !== 'aucun'}
          <div class="doc-logo">{#if global.logo}<img src={global.logo} alt="" />{:else}<span>LOGO</span>{/if}</div>
        {/if}
        <div class="doc-texte">
          {#if has('nom')}<strong>{global.identite?.nom_commercial}</strong>{/if}
          {#if has('slogan') && global.identite?.slogan}<em>{global.identite.slogan}</em>{/if}
          {#if has('coordonnees')}<span>{[global.identite?.adresse, global.identite?.telephones].filter(Boolean).join(' · ') || 'Adresse · Téléphones'}</span>{/if}
          {#if has('legal')}<span>NINEA {global.identite?.ninea || '—'} · RC {global.identite?.rc || '—'}</span>{/if}
        </div>
      </div>
      <div class="doc-titre">Situation des stocks <small>au 15/10/2026</small></div>
      <table class="doc-table">
        <thead><tr><th>Produit</th><th>Dépôt</th><th>Boutique</th><th>Total</th></tr></thead>
        <tbody>
          <tr><td>Heineken PM</td><td>28 cs</td><td>21</td><td>693</td></tr>
          <tr><td>Whisky Black 3/4</td><td>1 cs + 4 bt</td><td>4</td><td>20</td></tr>
          <tr><td>Merlot</td><td>6 cs</td><td>9</td><td>81</td></tr>
        </tbody>
      </table>
      <div class="doc-pied">{p.pied_page || 'Pied de page'} · page 1 / 1</div>
    </div>
    <p class="discret">Valeurs d’illustration. Les impressions arrivent avec les rapports (lot 4).</p>
  </section>
</div>

<style>
  .barre {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .barre p {
    flex: 1;
  }

  .disposition {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(360px, 1fr);
    gap: 20px;
    align-items: start;
  }

  .colonne {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .sous {
    margin: 18px 0 10px;
  }

  .pastilles {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
  }

  .pastille {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 6px;
    border: 1px solid var(--filet);
    border-radius: 0;
    background: var(--carte);
    font-size: 0.8em;
    font-weight: 700;
    color: var(--texte-2);
    cursor: pointer;
  }

  .pastille span {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 0;
    box-shadow: inset 0 0 0 2px rgb(255 255 255 / 30%);
  }

  .pastille.choisie {
    border-color: var(--a);
    box-shadow: 0 0 0 2px var(--a-pale);
    color: var(--texte);
  }

  .options {
    display: flex;
    align-items: center;
    gap: 22px;
    margin-top: 18px;
  }

  .segments {
    display: inline-flex;
    padding: 3px;
    border: 1px solid var(--filet);
    border-radius: 0;
  }

  .segments button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 0;
    border-radius: 0;
    background: none;
    font-weight: 700;
    color: var(--texte-2);
    cursor: pointer;
  }

  .segments button.actif {
    background: var(--p);
    color: var(--sur-p);
  }

  .modeles {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  .modele {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
    border: 1px solid var(--filet);
    border-radius: 0;
    background: var(--carte);
    text-align: left;
    cursor: pointer;
  }

  .modele.choisi {
    border-color: var(--a);
    box-shadow: 0 0 0 2px var(--a-pale);
  }

  .entete-options {
    display: grid;
    grid-template-columns: 200px 1fr;
    gap: 20px;
  }

  .cases {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 16px;
    padding-top: 6px;
  }

  .apercu-carte {
    position: sticky;
    top: 0;
  }

  .apercu-carte > p {
    margin-top: 10px;
  }

  /* --------- Aperçu d'une feuille (indépendant du thème de l'interface) */
  .feuille {
    margin-top: 12px;
    padding: 22px 22px 14px;
    background: #fff;
    color: #1b2524;
    border: 1px solid #d5dedc;
    border-radius: 0;
    box-shadow: 0 6px 20px rgb(0 0 0 / 12%);
    font-size: 11px;
  }

  .doc-entete {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 12px;
    border-bottom: 3px solid var(--da);
  }

  .doc-entete.logo-droite {
    flex-direction: row-reverse;
    text-align: right;
  }

  .doc-entete.logo-centre {
    flex-direction: column;
    text-align: center;
  }

  .doc-logo {
    display: grid;
    place-items: center;
    width: 64px;
    height: 48px;
    flex: none;
  }

  .doc-logo img {
    max-width: 64px;
    max-height: 48px;
    object-fit: contain;
  }

  .doc-logo span {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    border: 1px dashed #aab8b5;
    color: #8a9a97;
    font-size: 9px;
    font-weight: 800;
  }

  .doc-texte {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .doc-texte strong {
    font-size: 15px;
    font-weight: 800;
    color: var(--dp);
  }

  .doc-texte em {
    color: #55615f;
  }

  .doc-texte span {
    color: #55615f;
  }

  .doc-titre {
    margin: 14px 0 8px;
    font-size: 14px;
    font-weight: 800;
    color: var(--dp);
  }

  .doc-titre small {
    font-weight: 600;
    color: #6b7a78;
    font-size: 10px;
  }

  .doc-table {
    width: 100%;
    border-collapse: collapse;
  }

  .doc-table th {
    padding: 5px 6px;
    background: var(--dp);
    color: #fff;
    text-align: left;
    font-size: 9.5px;
  }

  .doc-table td {
    padding: 5px 6px;
    border-bottom: 1px solid #e3e9e8;
  }

  .doc-pied {
    margin-top: 16px;
    padding-top: 6px;
    border-top: 1px solid var(--da);
    color: #6b7a78;
    font-size: 9px;
    text-align: center;
  }

  /* Variantes de mise en page */
  .modele-bandeau .doc-entete {
    padding: 12px 14px;
    margin: -22px -22px 0;
    background: var(--dp);
    border-bottom: 4px solid var(--da);
    border-radius: 0;
  }

  .modele-bandeau .doc-texte strong,
  .modele-bandeau .doc-texte span,
  .modele-bandeau .doc-texte em {
    color: #fff;
  }

  .modele-sobre .doc-entete {
    border-bottom: 1px solid #c9d3d1;
  }

  .modele-sobre .doc-table th {
    background: none;
    color: var(--dp);
    border-bottom: 1.5px solid var(--dp);
  }

  .modele-compact {
    padding: 14px 14px 10px;
    font-size: 10px;
  }

  .modele-compact .doc-table td,
  .modele-compact .doc-table th {
    padding: 3px 5px;
  }
</style>
