<script lang="ts">
  import { fcfa } from '../lib/format'

  // Histogramme d'une seule série (ventes par jour) : barres fines, une échelle, infobulle au survol.
  let {
    points,
    hauteur = 170,
    unite = 'F'
  }: { points: { cle: string; libelle: string; valeur: number; detail?: string }[]; hauteur?: number; unite?: string } = $props()

  const max = $derived(Math.max(1, ...points.map((p) => p.valeur)))
  // Graduation lisible : 1, 2, 2,5 ou 5 × 10^n au-dessus du maximum.
  const echelle = $derived.by(() => {
    const p = 10 ** Math.floor(Math.log10(max))
    return [1, 2, 2.5, 5, 10].map((k) => k * p).find((v) => v >= max) ?? max
  })
  const pas = $derived(Math.max(1, Math.ceil(points.length / 10)))
</script>

<div class="graphique" style:--h="{hauteur}px">
  <div class="axe">
    <span>{fcfa(echelle)}</span>
    <span>{fcfa(echelle / 2)}</span>
    <span>0</span>
  </div>
  <div class="zone">
    <div class="grille"><i></i><i></i><i></i></div>
    <div class="barres">
      {#each points as p, i (p.cle)}
        <button type="button" class="colonne" aria-label="{p.libelle} : {fcfa(p.valeur)} {unite}">
          <span class="barre" class:nulle={p.valeur === 0} style:height="{(p.valeur / echelle) * 100}%"></span>
          <span class="bulle"><strong>{p.libelle}</strong>{fcfa(p.valeur)} {unite}{#if p.detail}<br /><small>{p.detail}</small>{/if}</span>
          <span class="etiquette">{i % pas === 0 ? p.libelle : ''}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .graphique {
    display: flex;
    gap: 8px;
    padding-bottom: 22px;
  }

  .axe {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: var(--h);
    margin-top: -7px;
    margin-bottom: -7px;
    color: var(--texte-3);
    font-size: 0.75em;
    text-align: right;
    min-width: 52px;
  }

  .zone {
    position: relative;
    flex: 1;
    height: var(--h);
  }

  .grille {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .grille i {
    border-top: 1px solid var(--filet);
  }

  .barres {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: flex-end;
    gap: 2px;
  }

  .colonne {
    position: relative;
    flex: 1;
    height: 100%;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    cursor: default;
  }

  .colonne:hover,
  .colonne:focus-visible {
    background: var(--survol);
  }

  .barre {
    display: block;
    width: min(70%, 22px);
    background: var(--p);
  }

  :global(:root[data-mode='sombre']) .barre {
    background: var(--a);
  }

  .barre.nulle {
    height: 2px !important;
    background: var(--filet);
  }

  .etiquette {
    position: absolute;
    top: calc(100% + 4px);
    color: var(--texte-3);
    font-size: 0.72em;
    white-space: nowrap;
  }

  .bulle {
    position: absolute;
    bottom: calc(100% + 6px);
    z-index: 5;
    display: none;
    padding: 6px 10px;
    background: var(--texte);
    color: var(--fond);
    font-size: 0.82em;
    white-space: nowrap;
    pointer-events: none;
  }

  .bulle strong {
    display: block;
  }

  .colonne:hover .bulle,
  .colonne:focus-visible .bulle {
    display: block;
  }
</style>
