<script lang="ts">
  import Apercu from '../../composants/Apercu.svelte'
  import { dateLongue, enConditionnements, entier, fcfa } from '../../lib/format'
  import type { JourneeEnregistree, LigneFiche } from '../../lib/types'

  // Chapitre 9 : situation du jour — ventes par produit, caisse, écarts avec la fiche, stocks après la journée.
  let { journee, lignes, onfermer }: { journee: JourneeEnregistree; lignes: LigneFiche[]; onfermer: () => void } = $props()

  const info = (id: number) => lignes.find((l) => l.produit_id === id)
  const nom = (id: number) => info(id)?.designation ?? `Produit ${id}`
  const actives = $derived(journee.lignes.filter((l) => l.ventes || l.alimentation || l.casse))
  const bouteilles = $derived(journee.lignes.reduce((t, l) => t + l.ventes, 0))
  const ecarts = $derived(
    journee.lignes.flatMap((l) => {
      const m: string[] = []
      if (l.stock_initial_fiche !== null && l.stock_initial_fiche !== l.stock_initial)
        m.push(`stock initial noté ${l.stock_initial_fiche}, attendu ${l.stock_initial}`)
      if (l.ventes_fiche !== null && l.ventes_fiche !== l.ventes) m.push(`ventes notées ${l.ventes_fiche}, calculées ${l.ventes}`)
      if (l.montant_fiche !== null && l.montant_fiche !== l.montant) m.push(`montant noté ${fcfa(l.montant_fiche)}, calculé ${fcfa(l.montant)}`)
      if (l.casse) m.push(`${l.casse} bt cassée(s)`)
      return m.length ? [{ id: l.produit_id, m }] : []
    })
  )
  const alim = (id: number, bt: number) => {
    const p = info(id)
    return p ? enConditionnements(bt, p.bt_par_conditionnement, p.conditionnement, p.conditionnement_pluriel) : `${bt} bt`
  }
</script>

<Apercu titre="Situation du jour" periode="Journée du {dateLongue(journee.date)}{journee.statut === 'validee' ? '' : ' (brouillon)'}" {onfermer}>
  <div class="doc-resume">
    <div><span>Bouteilles vendues</span><strong>{entier(bouteilles)}</strong></div>
    <div><span>Total des ventes</span><strong>{fcfa(journee.total_ventes)} F</strong></div>
    <div><span>Argent reçu</span><strong>{fcfa(journee.total_recu)} F</strong></div>
    <div><span>Dépenses</span><strong>{fcfa(journee.total_depenses)} F</strong></div>
    <div>
      <span>{journee.ecart < 0 ? 'Manquant' : journee.ecart > 0 ? 'Excédent' : 'Caisse juste'}</span>
      <strong class:rouge={journee.ecart < 0}>{journee.ecart > 0 ? '+' : ''}{fcfa(journee.ecart)} F</strong>
    </div>
  </div>

  <h2 class="doc-section">Ventes par produit</h2>
  <table class="doc-table">
    <thead>
      <tr><th>Produit</th><th class="nb">Initial</th><th class="nb">Alimentation</th><th class="nb">Total</th><th class="nb">Restant</th><th class="nb">Casse</th><th class="nb">Ventes</th><th class="nb">Prix</th><th class="nb">Montant</th></tr>
    </thead>
    <tbody>
      {#each actives as l (l.produit_id)}
        <tr>
          <td>{nom(l.produit_id)}</td>
          <td class="nb">{l.stock_initial}</td>
          <td class="nb">{l.alimentation ? alim(l.produit_id, l.alimentation) : '—'}</td>
          <td class="nb">{l.stock_total}</td>
          <td class="nb">{l.stock_restant}</td>
          <td class="nb" class:rouge={l.casse > 0}>{l.casse || '—'}</td>
          <td class="nb"><strong>{l.ventes}</strong></td>
          <td class="nb">{fcfa(l.prix)}</td>
          <td class="nb"><strong>{fcfa(l.montant)}</strong></td>
        </tr>
      {:else}
        <tr><td colspan="9">Aucune vente ce jour.</td></tr>
      {/each}
    </tbody>
    <tfoot>
      <tr><td colspan="6">Total</td><td class="nb">{entier(bouteilles)}</td><td></td><td class="nb">{fcfa(journee.total_ventes)}</td></tr>
    </tfoot>
  </table>

  <div class="doc-colonnes">
    <div>
      <h2 class="doc-section">Caisse</h2>
      <table class="doc-table">
        <tbody>
          <tr><td>Total des ventes</td><td class="nb">{fcfa(journee.total_ventes)}</td></tr>
          <tr><td>Argent reçu</td><td class="nb">{fcfa(journee.total_recu)}</td></tr>
          {#each journee.depenses as [libelle, montant], k (k)}<tr><td>Dépense : {libelle}</td><td class="nb">{fcfa(montant)}</td></tr>{/each}
        </tbody>
        <tfoot><tr><td>Écart (reçu + dépenses − ventes)</td><td class="nb" class:rouge={journee.ecart < 0}>{journee.ecart > 0 ? '+' : ''}{fcfa(journee.ecart)}</td></tr></tfoot>
      </table>
      {#if journee.observations}<p class="doc-note">Observations : {journee.observations}</p>{/if}
    </div>
    <div>
      <h2 class="doc-section">Contrôles</h2>
      {#if ecarts.length}
        <table class="doc-table">
          <tbody>
            {#each ecarts as e (e.id)}<tr><td><strong>{nom(e.id)}</strong> : {e.m.join(' ; ')}</td></tr>{/each}
          </tbody>
        </table>
      {:else}
        <p class="doc-note">Aucun écart entre la fiche du vendeur et les calculs, aucune casse.</p>
      {/if}
    </div>
  </div>

  <h2 class="doc-section">Stock en boutique après la journée</h2>
  <p class="doc-note">
    {journee.lignes.filter((l) => l.stock_restant > 0).map((l) => `${nom(l.produit_id)} : ${l.stock_restant}`).join(' · ') || 'Boutique vide.'}
  </p>
  <div class="doc-signatures">
    <div>Le vendeur</div>
    <div>Le propriétaire</div>
  </div>
</Apercu>
