<script lang="ts">
  import { onMount } from 'svelte'
  import { LockKeyhole } from '@lucide/svelte'
  import { appel } from '../lib/api'
  import { global } from '../lib/etat.svelte'

  // ET-10 : mot de passe à l'ouverture.
  let mot = $state('')
  let erreur = $state('')
  let enCours = $state(false)
  let aide = $state(false)
  let champ: HTMLInputElement | undefined = $state()

  onMount(() => champ?.focus())

  async function ouvrir(e: SubmitEvent) {
    e.preventDefault()
    erreur = ''
    enCours = true
    try {
      if (await appel<boolean>('deverrouiller', { motDePasse: mot })) {
        global.verrouille = false
        if (global.securite) global.securite.deverrouille = true
      } else {
        erreur = 'Mot de passe incorrect.'
        mot = ''
        champ?.focus()
      }
    } catch (err) {
      erreur = (err as Error).message
    } finally {
      enCours = false
    }
  }
</script>

<div class="fond">
  <form class="carte verrou" onsubmit={ouvrir}>
    <div class="tete">
      {#if global.logo}<img src={global.logo} alt="" />{:else}<span class="icone"><LockKeyhole size={28} /></span>{/if}
      <div>
        <h1>{global.identite?.nom_commercial}</h1>
        <p class="discret">Gestion Dépôt et Boutique</p>
      </div>
    </div>
    <label class="champ">
      <span>Mot de passe</span>
      <input class="saisie" type="password" bind:value={mot} bind:this={champ} autocomplete="current-password" />
    </label>
    {#if erreur}<p class="erreur-texte">{erreur}</p>{/if}
    <button class="btn btn-p" type="submit" disabled={enCours || !mot}>Ouvrir</button>
    <button type="button" class="oubli" onclick={() => (aide = !aide)}>Mot de passe oublié ?</button>
    {#if aide && global.securite}
      <div class="aide">
        <p>Vos données ne seront pas effacées. Pour retirer le mot de passe :</p>
        <ol>
          <li>fermez l’application ;</li>
          <li>dans le dossier <code>{global.securite.dossier_donnees}</code>, créez un fichier vide nommé <code>{global.securite.fichier_reinitialisation}</code> ;</li>
          <li>relancez l’application : elle s’ouvre sans mot de passe. Définissez-en un nouveau dans Paramètres → Sauvegarde et sécurité.</li>
        </ol>
      </div>
    {/if}
  </form>
</div>

<style>
  .fond {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 24px;
    background: linear-gradient(160deg, var(--p-pale), var(--fond) 60%);
  }

  .verrou {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 420px;
    padding: 30px;
    border-top: 4px solid var(--a);
  }

  .tete {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 8px;
  }

  .tete img {
    width: 64px;
    height: 52px;
    object-fit: contain;
  }

  .icone {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    background: var(--p);
    color: var(--a);
  }

  h1 {
    font-size: 1.35em;
    line-height: 1.2;
  }

  .oubli {
    align-self: center;
    border: 0;
    background: none;
    color: var(--texte-2);
    font: inherit;
    font-size: 0.9em;
    text-decoration: underline;
    cursor: pointer;
  }

  .aide {
    padding: 12px 14px;
    background: var(--survol);
    font-size: 0.9em;
  }

  .aide ol {
    margin: 6px 0 0 18px;
  }

  code {
    font-size: 0.92em;
    overflow-wrap: anywhere;
    font-weight: 700;
  }
</style>
