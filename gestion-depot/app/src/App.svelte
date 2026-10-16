<script lang="ts">
  import { onMount } from 'svelte'
  import { CircleCheck, CircleAlert, X } from '@lucide/svelte'
  import BarreTitre from './composants/BarreTitre.svelte'
  import Navigation from './composants/Navigation.svelte'
  import { chargerGlobal, global, lireAdresse, notifications, retirerNotification, route } from './lib/etat.svelte'
  import Accueil from './pages/Accueil.svelte'
  import Situation from './pages/Situation.svelte'
  import Parametres from './pages/Parametres.svelte'
  import Fiche from './pages/Fiche.svelte'
  import Depot from './pages/Depot.svelte'
  import Historique from './pages/Historique.svelte'
  import Verrou from './pages/Verrou.svelte'

  let erreur = $state('')

  onMount(() => {
    lireAdresse()
    chargerGlobal().catch((e: Error) => (erreur = e.message))
    const surAdresse = () => lireAdresse()
    window.addEventListener('hashchange', surAdresse)
    return () => window.removeEventListener('hashchange', surAdresse)
  })
</script>

<div class="fenetre">
  <BarreTitre />
  {#if erreur}
    <div class="demarrage"><p class="erreur-texte">{erreur}</p></div>
  {:else if !global.pret}
    <div class="demarrage"><p class="discret">Chargement…</p></div>
  {:else if global.verrouille}
    <Verrou />
  {:else}
    <Navigation />
    <main class="contenu">
      {#if route.page === 'accueil'}
        <Accueil />
      {:else if route.page === 'situation'}
        <Situation />
      {:else if route.page === 'parametres'}
        <Parametres />
      {:else if route.page === 'fiche'}
        {#key route.jour}<Fiche />{/key}
      {:else if route.page === 'depot'}
        <Depot />
      {:else}
        <Historique />
      {/if}
    </main>
  {/if}
</div>

<div class="notifications" role="status" aria-live="polite">
  {#each notifications as n (n.id)}
    <div class="notification" class:erreur={n.genre === 'erreur'}>
      {#if n.genre === 'erreur'}<CircleAlert size={19} />{:else}<CircleCheck size={19} />{/if}
      <span>{n.message}</span>
      <button class="btn-icone" aria-label="Fermer" onclick={() => retirerNotification(n.id)}><X size={15} /></button>
    </div>
  {/each}
</div>

<style>
  .fenetre {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .demarrage {
    flex: 1;
    display: grid;
    place-items: center;
  }

  .contenu {
    flex: 1;
    overflow-y: auto;
    padding: 28px 40px 40px;
  }

  .notifications {
    position: fixed;
    right: 22px;
    bottom: 22px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .notification {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 300px;
    max-width: 460px;
    padding: 10px 10px 10px 14px;
    background: var(--carte);
    border: 1px solid var(--filet);
    border-left: 4px solid var(--ok);
    box-shadow: var(--ombre);
    color: var(--ok);
    font-weight: 600;
  }

  .notification span {
    flex: 1;
    color: var(--texte);
  }

  .notification.erreur {
    border-left-color: var(--danger);
    color: var(--danger);
  }
</style>
