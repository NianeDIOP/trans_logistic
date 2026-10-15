<script lang="ts">
  import { ImageUp, Trash2 } from '@lucide/svelte'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import type { Identite } from '../../lib/types'

  // Copie modifiable de l'identité (EF-50).
  let saisie = $state<Identite>({ ...global.identite! })
  let enCours = $state(false)
  let entree: HTMLInputElement

  const modifie = $derived(JSON.stringify(saisie) !== JSON.stringify(global.identite))

  async function enregistrer(e: Event) {
    e.preventDefault()
    enCours = true
    try {
      global.identite = await appel<Identite>('identite_modifier', { identite: saisie })
      saisie = { ...global.identite }
      notifier('Informations de la boutique enregistrées.')
    } catch (err) {
      notifier((err as Error).message, 'erreur')
    } finally {
      enCours = false
    }
  }

  function choisirLogo(e: Event) {
    const fichier = (e.target as HTMLInputElement).files?.[0]
    if (!fichier) return
    const lecteur = new FileReader()
    lecteur.onload = async () => {
      try {
        await appel('logo_definir', { dataUrl: lecteur.result as string })
        global.logo = await appel<string | null>('logo_lire')
        notifier('Logo mis à jour.')
      } catch (err) {
        notifier((err as Error).message, 'erreur')
      }
    }
    lecteur.readAsDataURL(fichier)
    entree.value = ''
  }

  async function retirerLogo() {
    await appel('logo_definir', { dataUrl: null })
    global.logo = null
    notifier('Logo retiré.')
  }
</script>

<div class="disposition">
  <form class="carte" onsubmit={enregistrer}>
    <h2>Identité de la boutique</h2>
    <p class="discret">Reprise dans la barre latérale, l’en-tête et le pied de page des documents imprimés.</p>
    <div class="grille-2" style="margin-top: 18px">
      <label class="champ">
        <span>Nom commercial *</span>
        <input class="saisie" bind:value={saisie.nom_commercial} required />
      </label>
      <label class="champ">
        <span>Slogan</span>
        <input class="saisie" bind:value={saisie.slogan} placeholder="ex. Boissons fraîches à toute heure" />
      </label>
      <label class="champ" style="grid-column: 1 / -1">
        <span>Adresse</span>
        <input class="saisie" bind:value={saisie.adresse} />
      </label>
      <label class="champ">
        <span>Téléphones</span>
        <input class="saisie" bind:value={saisie.telephones} />
      </label>
      <label class="champ">
        <span>E-mail</span>
        <input class="saisie" type="email" bind:value={saisie.email} />
      </label>
      <label class="champ">
        <span>NINEA</span>
        <input class="saisie" bind:value={saisie.ninea} />
        <small>Facultatif</small>
      </label>
      <label class="champ">
        <span>Registre du commerce (RC)</span>
        <input class="saisie" bind:value={saisie.rc} />
        <small>Facultatif</small>
      </label>
    </div>
    <div class="actions">
      <button type="button" class="btn btn-f" disabled={!modifie} onclick={() => (saisie = { ...global.identite! })}>Annuler</button>
      <button class="btn btn-p" disabled={!modifie || enCours}>Enregistrer</button>
    </div>
  </form>

  <section class="carte logo">
    <h2>Logo</h2>
    <div class="apercu">
      {#if global.logo}
        <img src={global.logo} alt="Logo de la boutique" />
      {:else}
        <span class="discret">Aucun logo</span>
      {/if}
    </div>
    <input bind:this={entree} type="file" accept="image/png,image/jpeg,image/webp" hidden onchange={choisirLogo} />
    <div class="actions" style="justify-content: flex-start">
      <button class="btn btn-s" onclick={() => entree.click()}><ImageUp size={16} /> Choisir une image</button>
      {#if global.logo}<button class="btn btn-f btn-danger" onclick={retirerLogo}><Trash2 size={16} /> Retirer</button>{/if}
    </div>
    <p class="discret">PNG, JPEG ou WebP, 3 Mo maximum. Un fond transparent donne le meilleur rendu.</p>
  </section>
</div>

<style>
  .disposition {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
    gap: 20px;
    align-items: start;
  }

  .apercu {
    display: grid;
    place-items: center;
    height: 160px;
    margin-top: 14px;
    border: 1px dashed var(--filet);
    border-radius: 0;
    background: #fff;
  }

  .apercu img {
    max-width: 90%;
    max-height: 140px;
    object-fit: contain;
  }

  .logo .actions {
    margin-top: 14px;
    margin-bottom: 10px;
  }
</style>
