<script lang="ts">
  import { ArrowDown, ArrowRight } from '@lucide/svelte'
  import { changerSensEntree, preferences } from '../lib/etat.svelte'

  // Réglage de la touche Entrée dans les grilles de saisie (mémorisé sur ce poste).
</script>

<div class="sens" role="group" aria-label="Sens de la touche Entrée" title="Entrée : passer à la case du dessous (saisie par colonne) ou à droite (saisie par ligne). Maj+Entrée revient en arrière ; les flèches déplacent aussi.">
  <span>Entrée</span>
  <button class:actif={preferences.entree === 'colonne'} onclick={() => changerSensEntree('colonne')}><ArrowDown size={15} /> colonne</button>
  <button class:actif={preferences.entree === 'ligne'} onclick={() => changerSensEntree('ligne')}><ArrowRight size={15} /> ligne</button>
</div>

<style>
  .sens {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--filet);
    background: var(--carte);
    font-size: 0.88em;
  }

  span {
    padding: 0 10px;
    color: var(--texte-3);
    font-weight: 700;
  }

  button {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 32px;
    padding: 0 10px;
    border: 0;
    border-left: 1px solid var(--filet);
    background: none;
    color: var(--texte-2);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  button.actif {
    background: var(--p);
    color: var(--sur-p);
  }
</style>
