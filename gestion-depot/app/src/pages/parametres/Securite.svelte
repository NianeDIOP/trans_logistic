<script lang="ts">
  import { onMount } from 'svelte'
  import { open } from '@tauri-apps/plugin-dialog'
  import { revealItemInDir } from '@tauri-apps/plugin-opener'
  import { FolderOpen, HardDriveDownload, HardDriveUpload, KeyRound, Lock, RotateCcw, ShieldCheck } from '@lucide/svelte'
  import Modale from '../../composants/Modale.svelte'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import { dateCourte, entier } from '../../lib/format'
  import type { EtatSecurite, InfosSauvegarde } from '../../lib/types'

  // Chapitre 12 : mot de passe (ET-10), sauvegardes automatiques (ET-11), sauvegarde manuelle et
  // restauration (ET-12), changement d'ordinateur (ET-13).
  let etat = $state<EtatSecurite | null>(null)
  let mdp = $state({ actuel: '', nouveau: '', confirmation: '' })
  let enCours = $state(false)
  let restauration = $state<{ chemin: string; infos: InfosSauvegarde } | null>(null)
  let confirmation = $state('')

  async function charger() {
    etat = await appel<EtatSecurite>('securite_etat')
    global.securite = etat
  }
  onMount(charger)

  async function changerMotDePasse(retirer: boolean) {
    if (!retirer && mdp.nouveau !== mdp.confirmation) return notifier('Les deux saisies du nouveau mot de passe diffèrent.', 'erreur')
    enCours = true
    try {
      await appel('mot_de_passe_changer', { actuel: mdp.actuel, nouveau: retirer ? null : mdp.nouveau })
      notifier(retirer ? 'Mot de passe retiré.' : 'Mot de passe enregistré : il sera demandé à chaque ouverture.')
      mdp = { actuel: '', nouveau: '', confirmation: '' }
      await charger()
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    } finally {
      enCours = false
    }
  }

  async function sauvegarder() {
    const dossier = await open({ directory: true, title: 'Choisir le dossier ou la clé USB de sauvegarde' })
    if (typeof dossier !== 'string') return
    enCours = true
    try {
      const chemin = await appel<string>('sauvegarde_creer', { dossier })
      notifier('Sauvegarde créée.')
      revealItemInDir(chemin).catch(() => undefined)
      await charger()
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    } finally {
      enCours = false
    }
  }

  async function choisirRestauration(chemin?: string) {
    if (!chemin) {
      const choisi = await open({ title: 'Choisir une sauvegarde à restaurer', filters: [{ name: 'Sauvegarde Gestion Dépôt', extensions: ['gdsauv', 'db'] }] })
      if (typeof choisi !== 'string') return
      chemin = choisi
    }
    try {
      restauration = { chemin, infos: await appel<InfosSauvegarde>('sauvegarde_verifier', { chemin }) }
      confirmation = ''
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    }
  }

  async function restaurer() {
    if (!restauration) return
    enCours = true
    try {
      await appel('sauvegarde_restaurer', { chemin: restauration.chemin })
      notifier('Données restaurées. L’application se recharge…')
      setTimeout(() => location.reload(), 900)
    } catch (e) {
      notifier((e as Error).message, 'erreur')
      enCours = false
    }
  }

  const joursDepuis = (iso: string | null) => {
    if (!iso || !etat) return null
    return Math.round((Date.parse(etat.date_du_jour) - Date.parse(iso)) / 86_400_000)
  }
  const retard = $derived(joursDepuis(etat?.derniere_sauvegarde_externe ?? null))
  const taille = (o: number) => (o >= 1_048_576 ? `${(o / 1_048_576).toFixed(1).replace('.', ',')} Mo` : `${entier(Math.ceil(o / 1024))} Ko`)
  const dateCopie = (nom: string) => {
    const m = nom.match(/(\d{4}-\d{2}-\d{2})(?:_(\d{2})h(\d{2}))?/)
    return m ? `${dateCourte(m[1])}${m[2] ? ` à ${m[2]}:${m[3]}` : ''}` : nom
  }
</script>

{#if etat}
  <div class="grille">
    <section class="carte">
      <h2><KeyRound size={19} /> Mot de passe à l’ouverture</h2>
      <p class="discret">
        {etat.protege ? 'Un mot de passe est demandé à chaque ouverture de l’application.' : 'Aucun mot de passe : l’application s’ouvre directement. Recommandé : en définir un.'}
      </p>
      <div class="champs">
        {#if etat.protege}
          <label class="champ"><span>Mot de passe actuel</span><input class="saisie" type="password" bind:value={mdp.actuel} /></label>
        {/if}
        <label class="champ"><span>{etat.protege ? 'Nouveau mot de passe' : 'Mot de passe'}</span><input class="saisie" type="password" bind:value={mdp.nouveau} autocomplete="new-password" /></label>
        <label class="champ"><span>Confirmation</span><input class="saisie" type="password" bind:value={mdp.confirmation} autocomplete="new-password" /></label>
      </div>
      <div class="boutons">
        <button class="btn btn-p" disabled={enCours || mdp.nouveau.length < 4} onclick={() => changerMotDePasse(false)}>
          <ShieldCheck size={16} /> {etat.protege ? 'Changer le mot de passe' : 'Définir le mot de passe'}
        </button>
        {#if etat.protege}
          <button class="btn btn-f" disabled={enCours || !mdp.actuel} onclick={() => changerMotDePasse(true)}>Retirer le mot de passe</button>
        {/if}
      </div>
      <p class="note">
        Oubli : fermez l’application, créez un fichier vide nommé <code>{etat.fichier_reinitialisation}</code> dans le dossier des
        données ci-dessous, puis relancez. Le mot de passe est retiré, les données restent intactes.
      </p>
    </section>

    <section class="carte">
      <h2><HardDriveDownload size={19} /> Sauvegarde sur clé USB ou dans un dossier</h2>
      <p class="discret">Un seul fichier contient toutes les données et le logo. Gardez-en une copie hors de l’ordinateur.</p>
      <div class="etat-sauvegarde" class:alerte={retard === null || retard > 7}>
        {#if etat.derniere_sauvegarde_externe}
          Dernière sauvegarde externe : <strong>{dateCourte(etat.derniere_sauvegarde_externe)}</strong>
          {retard ? `(il y a ${retard} jour${retard > 1 ? 's' : ''})` : '(aujourd’hui)'}.
        {:else}
          <strong>Aucune sauvegarde externe pour l’instant.</strong>
        {/if}
        {#if retard === null || retard > 7}Pensez à en faire une chaque semaine.{/if}
      </div>
      <div class="boutons">
        <button class="btn btn-p" disabled={enCours} onclick={sauvegarder}><HardDriveDownload size={16} /> Sauvegarder maintenant</button>
        <button class="btn btn-s" disabled={enCours} onclick={() => choisirRestauration()}><HardDriveUpload size={16} /> Restaurer une sauvegarde…</button>
      </div>
      <h3>Changer d’ordinateur</h3>
      <p class="note">
        Sur l’ancien ordinateur : « Sauvegarder maintenant » vers une clé USB. Sur le nouveau : installez l’application, puis
        « Restaurer une sauvegarde » et choisissez le fichier <code>.gdsauv</code> de la clé.
      </p>
    </section>
  </div>

  <section class="carte">
    <div class="entete-copies">
      <div>
        <h2><RotateCcw size={19} /> Copies automatiques</h2>
        <p class="discret">Une copie est faite chaque jour au démarrage ; les 30 plus récentes sont conservées.</p>
      </div>
      <button class="btn btn-f" onclick={() => revealItemInDir(etat!.copies[0]?.chemin ?? etat!.dossier_sauvegardes).catch(() => undefined)}>
        <FolderOpen size={16} /> Ouvrir le dossier
      </button>
    </div>
    <table class="tableau">
      <thead><tr><th>Copie</th><th>Date</th><th class="nb">Taille</th><th></th></tr></thead>
      <tbody>
        {#each etat.copies.slice(0, 10) as c (c.nom)}
          <tr>
            <td>{c.nom.startsWith('avant-') ? 'Avant restauration' : 'Automatique'}</td>
            <td>{dateCopie(c.nom)}</td>
            <td class="nb discret">{taille(c.octets)}</td>
            <td class="nb"><button class="btn btn-f petit" onclick={() => choisirRestauration(c.chemin)}>Restaurer</button></td>
          </tr>
        {:else}
          <tr><td colspan="4" class="vide">Aucune copie pour l’instant.</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="note">Dossier des données : <code>{etat.dossier_donnees}</code> · journal des erreurs : <code>journal-erreurs.log</code></p>
  </section>
{/if}

{#if restauration}
  {@const r = restauration}
  <Modale titre="Restaurer cette sauvegarde ?" sousTitre="Les données actuelles seront remplacées." largeur={540} onfermer={() => (restauration = null)}>
    <dl class="infos">
      <div><dt>Boutique</dt><dd>{r.infos.nom_boutique}</dd></div>
      <div><dt>Produits</dt><dd>{r.infos.nb_produits}</dd></div>
      <div><dt>Journées validées</dt><dd>{r.infos.nb_journees}</dd></div>
      <div><dt>Dernière journée</dt><dd>{dateCourte(r.infos.derniere_journee)}</dd></div>
    </dl>
    <p class="discret" style="margin: 12px 0">Une copie de sécurité des données actuelles est faite avant le remplacement (visible dans les copies automatiques).</p>
    <label class="champ"><span>Tapez RESTAURER pour confirmer</span><input class="saisie" bind:value={confirmation} /></label>
    {#snippet pied()}
      <button class="btn btn-f" onclick={() => (restauration = null)}>Annuler</button>
      <button class="btn btn-danger" disabled={enCours || confirmation.trim().toUpperCase() !== 'RESTAURER'} onclick={restaurer}><Lock size={16} /> Restaurer</button>
    {/snippet}
  </Modale>
{/if}

<style>
  .grille {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 20px;
    align-items: start;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  h3 {
    margin: 18px 0 4px;
    font-size: 1em;
  }

  .champs {
    display: grid;
    gap: 10px;
    margin: 14px 0;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
  }

  .note {
    margin-top: 12px;
    color: var(--texte-2);
    font-size: 0.9em;
  }

  code {
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .etat-sauvegarde {
    margin-top: 14px;
    padding: 10px 14px;
    background: var(--ok-pale);
    border-left: 3px solid var(--ok);
  }

  .etat-sauvegarde.alerte {
    background: var(--alerte-pale);
    border-left-color: var(--alerte);
  }

  .entete-copies {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
  }

  .petit {
    height: 30px;
    padding: 0 12px;
  }

  .infos {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .infos dt {
    color: var(--texte-3);
    font-size: 0.8em;
    font-weight: 700;
    text-transform: uppercase;
  }

  .infos dd {
    font-weight: 800;
  }
</style>
