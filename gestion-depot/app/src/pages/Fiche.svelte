<script lang="ts">
  import { onMount, tick } from 'svelte'
  import { ChevronLeft, ChevronRight, CircleAlert, TriangleAlert, Plus, Trash2, Lock, RotateCcw, FileText, Printer } from '@lucide/svelte'
  import EnTete from '../composants/EnTete.svelte'
  import Modale from '../composants/Modale.svelte'
  import FicheVierge from './documents/FicheVierge.svelte'
  import SituationJour from './documents/SituationJour.svelte'
  import { appel } from '../lib/api'
  import { global, notifier, route } from '../lib/etat.svelte'
  import { dateCourte, dateLongue, decalerDate, enConditionnements, entier, fcfa, lireEntier, valeur } from '../lib/format'
  import type { ApercuFiche, FichePreparee, FicheSaisie, JourneeEnregistree, LigneFiche, SaisieLigne } from '../lib/types'

  // Fiche journalière (EF-10 à EF-14) : saisie dans l'ordre de la fiche papier, calculs et contrôles
  // en direct par le cœur Rust (fiche_apercu), brouillon, validation, réouverture (RG-22).

  interface Saisie { siNote: string; alimCond: string; alimBt: string; restant: string; casse: string; ventesNote: string; montantNote: string }

  let date = $state(route.jour || global.date)
  let docOuvert = $state<'' | 'vierge' | 'situation'>('')
  let prep = $state<FichePreparee | null>(null)
  let saisies = $state<Record<number, Saisie>>({})
  let recu = $state('')
  let depenses = $state<{ libelle: string; montant: string }[]>([])
  let observations = $state('')
  let controle = $state(false)
  let apercu = $state<ApercuFiche | null>(null)
  let erreur = $state('')
  let enCours = $state(false)
  let confirmation = $state(false)
  let reouverture = $state<{ motif: string } | null>(null)

  const validee = $derived(prep?.existante?.statut === 'validee')
  const vide = (): Saisie => ({ siNote: '', alimCond: '', alimBt: '', restant: '', casse: '', ventesNote: '', montantNote: '' })
  const optionnel = (s: string) => (s.trim() === '' ? null : valeur(s))

  async function charger() {
    erreur = ''
    apercu = null
    try {
      const p = await appel<FichePreparee>('fiche_preparer', { date })
      const s: Record<number, Saisie> = {}
      for (const l of p.lignes) s[l.produit_id] = vide()
      const ex = p.existante
      if (ex) {
        // Reprise d'un brouillon : l'alimentation notée sur la fiche = total − déjà enregistrée au dépôt.
        for (const e of ex.lignes) {
          const l = p.lignes.find((x) => x.produit_id === e.produit_id)
          if (!l || !s[e.produit_id]) continue
          const supp = ex.statut === 'validee' ? 0 : e.alimentation - l.alimentation_enregistree
          s[e.produit_id] = {
            siNote: e.stock_initial_fiche?.toString() ?? '',
            alimCond: supp >= l.bt_par_conditionnement ? String(Math.floor(supp / l.bt_par_conditionnement)) : '',
            alimBt: supp % l.bt_par_conditionnement ? String(supp % l.bt_par_conditionnement) : '',
            restant: e.stock_restant !== e.stock_total - e.casse || e.ventes > 0 ? String(e.stock_restant) : '',
            casse: e.casse ? String(e.casse) : '',
            ventesNote: e.ventes_fiche?.toString() ?? '',
            montantNote: e.montant_fiche?.toString() ?? ''
          }
        }
        recu = ex.total_recu ? String(ex.total_recu) : ''
        depenses = ex.depenses.map(([libelle, montant]) => ({ libelle, montant: String(montant) }))
        observations = ex.observations
        controle = ex.lignes.some((e) => e.stock_initial_fiche !== null || e.ventes_fiche !== null || e.montant_fiche !== null)
      } else {
        recu = ''
        depenses = []
        observations = ''
      }
      saisies = s
      prep = p
    } catch (e) {
      erreur = (e as Error).message
    }
  }

  onMount(charger)

  function fiche(): FicheSaisie {
    const lignes: [number, SaisieLigne][] = (prep?.lignes ?? []).map((l) => {
      const s = saisies[l.produit_id] ?? vide()
      return [
        l.produit_id,
        {
          stock_initial: 0,
          stock_initial_fiche: controle ? optionnel(s.siNote) : null,
          alimentation_conditionnements: valeur(s.alimCond),
          alimentation_bouteilles: valeur(s.alimBt),
          stock_restant: optionnel(s.restant),
          casse: valeur(s.casse),
          ventes_fiche: controle ? optionnel(s.ventesNote) : null,
          prix_fiche: null,
          montant_fiche: controle ? optionnel(s.montantNote) : null
        }
      ]
    })
    return {
      date,
      lignes,
      total_recu: valeur(recu),
      depenses: depenses.filter((d) => d.libelle.trim() || d.montant.trim()).map((d) => [d.libelle, valeur(d.montant)]),
      observations
    }
  }

  // Une saisie non numérique bloque l'envoi au calcul.
  const champsInvalides = $derived(
    Object.values(saisies).some((s) => Object.values(s).some((v) => v.trim() !== '' && Number.isNaN(lireEntier(v) ?? 0))) ||
      [recu, ...depenses.map((d) => d.montant)].some((v) => v.trim() !== '' && Number.isNaN(lireEntier(v) ?? 0))
  )

  // Calcul en direct (mêmes règles que la validation), après une courte pause de frappe.
  let minuteur: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    if (!prep || validee) return
    const f = JSON.stringify(fiche())
    if (champsInvalides) return
    clearTimeout(minuteur)
    minuteur = setTimeout(async () => {
      try {
        apercu = await appel<ApercuFiche>('fiche_apercu', { fiche: JSON.parse(f) })
      } catch (e) {
        erreur = (e as Error).message
      }
    }, 200)
  })

  const calcul = (id: number) => apercu?.lignes.find((l) => l.produit_id === id)
  const nbBloquantes = $derived(apercu?.lignes.filter((l) => l.alertes.some((a) => a.bloquante)).length ?? 0)
  const nbAlertes = $derived(apercu?.lignes.filter((l) => l.alertes.length).length ?? 0)
  const bouteillesVendues = $derived(apercu?.lignes.reduce((t, l) => t + l.calcul.ventes, 0) ?? 0)

  async function brouillon() {
    enCours = true
    try {
      await appel('fiche_brouillon', { fiche: fiche() })
      notifier('Brouillon enregistré.')
      await charger()
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    } finally {
      enCours = false
    }
  }

  async function valider() {
    enCours = true
    try {
      await appel('fiche_valider', { fiche: fiche() })
      confirmation = false
      notifier(`Journée du ${dateCourte(date)} validée : stocks et caisse à jour.`)
      await charger()
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    } finally {
      enCours = false
    }
  }

  async function rouvrir() {
    if (!reouverture) return
    try {
      await appel('journee_reouvrir', { date, motif: reouverture.motif })
      reouverture = null
      notifier('Journée rouverte en brouillon : corrigez puis validez de nouveau.')
      await charger()
    } catch (e) {
      notifier((e as Error).message, 'erreur')
    }
  }

  async function changerDate(jours: number) {
    date = decalerDate(date, jours)
    await charger()
  }

  // Entrée : passe à la même colonne de la ligne suivante.
  async function suivant(e: KeyboardEvent) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const cible = e.target as HTMLInputElement
    const col = cible.dataset.col
    const champs = [...document.querySelectorAll<HTMLInputElement>(`input[data-col="${col}"]`)]
    const i = champs.indexOf(cible)
    await tick()
    champs[i + 1]?.focus()
    champs[i + 1]?.select()
  }

  const fmt = (l: LigneFiche, bt: number) => enConditionnements(bt, l.bt_par_conditionnement, l.conditionnement, l.conditionnement_pluriel)
  const enregistree = (id: number) => prep?.existante?.lignes.find((e) => e.produit_id === id)
</script>

<EnTete titre="Fiche du jour" sousTitre="Recopiez la fiche du vendeur : l’application calcule les ventes, contrôle et met à jour les stocks à la validation." />

<section class="barre-date">
  <div class="navigateur">
    <button class="btn btn-s" aria-label="Jour précédent" onclick={() => changerDate(-1)}><ChevronLeft size={17} /></button>
    <input class="saisie" type="date" bind:value={date} onchange={charger} />
    <button class="btn btn-s" aria-label="Jour suivant" onclick={() => changerDate(1)}><ChevronRight size={17} /></button>
  </div>
  <strong class="jour">{dateLongue(date)}</strong>
  {#if validee}
    <span class="badge badge-ok"><Lock size={12} /> Validée</span>
  {:else if prep?.existante}
    <span class="badge badge-alerte">Brouillon</span>
  {:else}
    <span class="badge badge-neutre">Nouvelle fiche</span>
  {/if}
  <span class="espace"></span>
  {#if prep?.derniere_validee}<span class="discret">Dernière journée validée : {dateCourte(prep.derniere_validee)}</span>{/if}
  {#if !validee}
    <label class="case"><input type="checkbox" bind:checked={controle} /> Contrôler les chiffres du vendeur</label>
  {/if}
  <button class="btn btn-f" disabled={!prep} onclick={() => (docOuvert = 'vierge')}><FileText size={16} /> Fiche vierge</button>
  {#if validee}
    <button class="btn btn-s" onclick={() => (docOuvert = 'situation')}><Printer size={16} /> Situation du jour</button>
  {/if}
</section>

{#if docOuvert === 'vierge' && prep}
  <FicheVierge {date} lignes={prep.lignes} onfermer={() => (docOuvert = '')} />
{:else if docOuvert === 'situation' && prep?.existante}
  <SituationJour journee={prep.existante} lignes={prep.lignes} onfermer={() => (docOuvert = '')} />
{/if}

{#if erreur}<p class="erreur-texte">{erreur}</p>{/if}

{#if prep}
  <div class="disposition">
    <section class="carte tableau-fiche">
      <table class="tableau">
        <thead>
          <tr>
            <th>N°</th>
            <th>Produit</th>
            <th class="nb">Stock initial</th>
            {#if controle && !validee}<th class="nb vendeur">Initial noté</th>{/if}
            <th class="nb">Alim. cond.</th>
            <th class="nb">Alim. bt</th>
            <th class="nb">Stock total</th>
            <th class="nb">Restant</th>
            <th class="nb">Casse</th>
            <th class="nb">Ventes</th>
            {#if controle && !validee}<th class="nb vendeur">Ventes notées</th>{/if}
            <th class="nb">Prix</th>
            <th class="nb">Montant</th>
            {#if controle && !validee}<th class="nb vendeur">Montant noté</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each prep.lignes as l, i (l.produit_id)}
            {#if validee}
              {@const e = enregistree(l.produit_id)}
              <tr class:actif={(e?.ventes ?? 0) > 0}>
                <td class="discret">{i + 1}</td>
                <td><strong>{l.designation}</strong></td>
                <td class="nb">{entier(e?.stock_initial ?? 0)}</td>
                <td class="nb" colspan="2">{e?.alimentation ? fmt(l, e.alimentation) : '—'}</td>
                <td class="nb">{entier(e?.stock_total ?? 0)}</td>
                <td class="nb">{entier(e?.stock_restant ?? 0)}</td>
                <td class="nb">{e?.casse || '—'}</td>
                <td class="nb"><strong>{entier(e?.ventes ?? 0)}</strong></td>
                <td class="nb">{fcfa(e?.prix ?? 0)}</td>
                <td class="nb"><strong>{fcfa(e?.montant ?? 0)}</strong></td>
              </tr>
            {:else if saisies[l.produit_id]}
              {@const c = calcul(l.produit_id)}
              {@const bloque = c?.alertes.some((a) => a.bloquante)}
              <tr class:actif={(c?.calcul.ventes ?? 0) > 0} class:bloque class:averti={!bloque && (c?.alertes.length ?? 0) > 0}>
                <td class="discret">{i + 1}</td>
                <td>
                  <strong>{l.designation}</strong>
                  <span class="discret format">{l.conditionnement} de {l.bt_par_conditionnement}</span>
                  {#if l.prix === null}<span class="badge badge-danger">sans prix</span>{/if}
                </td>
                <td class="nb">{entier(l.stock_initial)}</td>
                {#if controle}
                  <td class="nb vendeur"><input class="saisie nombre cellule" data-col="si" inputmode="numeric" bind:value={saisies[l.produit_id].siNote} onkeydown={suivant} /></td>
                {/if}
                <td class="nb">
                  <input class="saisie nombre cellule" data-col="ac" inputmode="numeric" bind:value={saisies[l.produit_id].alimCond} onkeydown={suivant} title="{l.conditionnement_pluriel} reçu(e)s du dépôt" />
                </td>
                <td class="nb">
                  <input class="saisie nombre cellule" data-col="ab" inputmode="numeric" bind:value={saisies[l.produit_id].alimBt} onkeydown={suivant} />
                  {#if l.alimentation_enregistree}<small class="deja" title="Déjà enregistrée dans le module Dépôt">+{l.alimentation_enregistree}</small>{/if}
                </td>
                <td class="nb">{c ? entier(c.calcul.stock_total) : '…'}</td>
                <td class="nb">
                  <input class="saisie nombre cellule restant" data-col="r" inputmode="numeric" placeholder={c ? String(c.calcul.stock_total) : ''} bind:value={saisies[l.produit_id].restant} onkeydown={suivant} />
                </td>
                <td class="nb"><input class="saisie nombre cellule etroite" data-col="k" inputmode="numeric" bind:value={saisies[l.produit_id].casse} onkeydown={suivant} /></td>
                <td class="nb"><strong>{c ? entier(c.calcul.ventes) : '…'}</strong></td>
                {#if controle}
                  <td class="nb vendeur"><input class="saisie nombre cellule" data-col="v" inputmode="numeric" bind:value={saisies[l.produit_id].ventesNote} onkeydown={suivant} /></td>
                {/if}
                <td class="nb discret">{l.prix === null ? '—' : fcfa(l.prix)}</td>
                <td class="nb"><strong>{c ? fcfa(c.calcul.montant) : '…'}</strong></td>
                {#if controle}
                  <td class="nb vendeur"><input class="saisie nombre cellule large" data-col="m" inputmode="numeric" bind:value={saisies[l.produit_id].montantNote} onkeydown={suivant} /></td>
                {/if}
              </tr>
              {#if c?.alertes.length}
                <tr class="ligne-alertes">
                  <td></td>
                  <td colspan={controle ? 13 : 10}>
                    {#each c.alertes as a, k (k)}
                      <span class:bloquante={a.bloquante}>
                        {#if a.bloquante}<CircleAlert size={14} />{:else}<TriangleAlert size={14} />{/if}
                        {a.message}
                      </span>
                    {/each}
                  </td>
                </tr>
              {/if}
            {/if}
          {/each}
        </tbody>
      </table>
    </section>

    <aside class="carte caisse">
      <h2>Caisse du jour</h2>
      {#if validee && prep.existante}
        {@const ex = prep.existante as JourneeEnregistree}
        <dl class="bilan">
          <div><dt>Total des ventes</dt><dd>{fcfa(ex.total_ventes)} F</dd></div>
          <div><dt>Total reçu</dt><dd>{fcfa(ex.total_recu)} F</dd></div>
          <div><dt>Dépenses</dt><dd>{fcfa(ex.total_depenses)} F</dd></div>
        </dl>
        {#each ex.depenses as [libelle, montant], k (k)}<p class="depense-lue">{libelle} <span>{fcfa(montant)} F</span></p>{/each}
        <div class="ecart" class:manquant={ex.ecart < 0} class:excedent={ex.ecart > 0}>
          <span>{ex.ecart < 0 ? 'Manquant' : ex.ecart > 0 ? 'Excédent' : 'Caisse juste'}</span>
          <strong>{ex.ecart > 0 ? '+' : ''}{fcfa(ex.ecart)} F</strong>
        </div>
        {#if ex.observations}<p class="discret">{ex.observations}</p>{/if}
        <p class="discret">Validée le {ex.valide_le ? dateCourte(ex.valide_le.slice(0, 10)) : '—'}.</p>
        {#if ex.reouvrable}
          <button class="btn btn-s" onclick={() => (reouverture = { motif: '' })}><RotateCcw size={16} /> Rouvrir pour corriger</button>
        {/if}
      {:else}
        <dl class="bilan">
          <div><dt>Bouteilles vendues</dt><dd>{entier(bouteillesVendues)}</dd></div>
          <div><dt>Total des ventes</dt><dd>{fcfa(apercu?.caisse.total_ventes ?? 0)} F</dd></div>
        </dl>
        <label class="champ">
          <span>Total reçu (argent remis)</span>
          <input class="saisie nombre gros" inputmode="numeric" bind:value={recu} />
        </label>
        <div class="depenses">
          <span class="titre-depenses">Dépenses payées avec la caisse</span>
          {#each depenses as d, k (k)}
            <div class="depense">
              <input class="saisie" placeholder="Libellé" bind:value={d.libelle} />
              <input class="saisie nombre" inputmode="numeric" placeholder="Montant" bind:value={d.montant} />
              <button class="btn-icone" aria-label="Retirer" onclick={() => depenses.splice(k, 1)}><Trash2 size={15} /></button>
            </div>
          {/each}
          <button class="btn btn-f" onclick={() => depenses.push({ libelle: '', montant: '' })}><Plus size={15} /> Ajouter une dépense</button>
        </div>
        {#if apercu}
          <div class="ecart" class:manquant={apercu.caisse.ecart < 0} class:excedent={apercu.caisse.ecart > 0}>
            <span>{apercu.caisse.ecart < 0 ? 'Manquant' : apercu.caisse.ecart > 0 ? 'Excédent' : 'Caisse juste'}</span>
            <strong>{apercu.caisse.ecart > 0 ? '+' : ''}{fcfa(apercu.caisse.ecart)} F</strong>
          </div>
        {/if}
        <label class="champ"><span>Observations</span><textarea class="saisie" bind:value={observations}></textarea></label>
        {#if champsInvalides}<p class="erreur-texte">Une saisie n’est pas un nombre entier.</p>{/if}
        {#if nbBloquantes}<p class="erreur-texte">{nbBloquantes} ligne(s) à corriger avant de valider.</p>{:else if nbAlertes}<p class="avertissement">{nbAlertes} ligne(s) avec un écart signalé.</p>{/if}
        <div class="boutons">
          <button class="btn btn-s" disabled={enCours || champsInvalides} onclick={brouillon}>Enregistrer le brouillon</button>
          <button class="btn btn-p" disabled={enCours || champsInvalides || !apercu || nbBloquantes > 0} onclick={() => (confirmation = true)}>Valider la journée</button>
        </div>
      {/if}
    </aside>
  </div>
{/if}

{#if confirmation && apercu}
  <Modale titre="Valider la journée du {dateCourte(date)} ?" sousTitre="Les stocks seront mis à jour et la fiche sera figée." largeur={480} onfermer={() => (confirmation = false)}>
    <dl class="resume">
      <div><dt>Bouteilles vendues</dt><dd>{entier(bouteillesVendues)}</dd></div>
      <div><dt>Total des ventes</dt><dd>{fcfa(apercu.caisse.total_ventes)} F</dd></div>
      <div><dt>Total reçu</dt><dd>{fcfa(apercu.caisse.total_recu)} F</dd></div>
      <div><dt>Dépenses</dt><dd>{fcfa(apercu.caisse.total_depenses)} F</dd></div>
      <div><dt>Écart de caisse</dt><dd class:rouge={apercu.caisse.ecart < 0}>{apercu.caisse.ecart > 0 ? '+' : ''}{fcfa(apercu.caisse.ecart)} F</dd></div>
      <div><dt>Lignes avec alerte</dt><dd>{nbAlertes}</dd></div>
    </dl>
    {#snippet pied()}
      <button class="btn btn-f" onclick={() => (confirmation = false)}>Revenir à la fiche</button>
      <button class="btn btn-p" disabled={enCours} onclick={valider}>Valider</button>
    {/snippet}
  </Modale>
{/if}

{#if reouverture}
  <Modale titre="Rouvrir la journée du {dateCourte(date)}" sousTitre="Les ventes et l’alimentation de la fiche sont annulées, la journée repasse en brouillon." largeur={480} onfermer={() => (reouverture = null)}>
    <label class="champ"><span>Motif (obligatoire, conservé au journal)</span><input class="saisie" bind:value={reouverture.motif} placeholder="ex. Restant mal compté sur Heineken PM" /></label>
    {#snippet pied()}
      <button class="btn btn-f" onclick={() => (reouverture = null)}>Annuler</button>
      <button class="btn btn-p" disabled={(reouverture?.motif.trim().length ?? 0) < 3} onclick={rouvrir}>Rouvrir</button>
    {/snippet}
  </Modale>
{/if}

<style>
  .barre-date {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 16px;
  }

  .navigateur {
    display: flex;
    gap: 4px;
  }

  .navigateur .btn {
    padding: 0 10px;
  }

  .jour {
    text-transform: capitalize;
  }

  .espace {
    flex: 1;
  }

  .disposition {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 18px;
    align-items: start;
  }

  .tableau-fiche {
    padding: 2px 4px;
    overflow-x: auto;
  }

  .tableau-fiche td,
  .tableau-fiche th {
    padding: 5px 7px;
  }

  .format {
    display: block;
    font-size: 0.78em;
  }

  .cellule {
    width: 62px;
    height: 30px;
    padding: 0 7px;
  }

  .cellule.etroite {
    width: 50px;
  }

  .cellule.large {
    width: 86px;
  }

  .cellule.restant {
    border-color: color-mix(in srgb, var(--a) 60%, var(--filet));
  }

  .vendeur {
    background: var(--survol);
  }

  .deja {
    display: block;
    color: var(--ok);
    font-weight: 700;
  }

  tr.actif > td {
    background: color-mix(in srgb, var(--a) 7%, transparent);
  }

  tr.bloque > td {
    background: var(--danger-pale);
  }

  tr.averti > td {
    background: var(--alerte-pale);
  }

  .ligne-alertes td {
    padding-top: 0;
    border-bottom: 1px solid var(--filet);
  }

  .ligne-alertes span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-right: 16px;
    color: var(--alerte);
    font-size: 0.86em;
    font-weight: 600;
  }

  .ligne-alertes span.bloquante {
    color: var(--danger);
  }

  .caisse {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .bilan div,
  .resume div {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid var(--filet);
  }

  .bilan dt,
  .resume dt {
    color: var(--texte-2);
  }

  .bilan dd,
  .resume dd {
    font-weight: 800;
  }

  .gros {
    height: 46px;
    font-size: 1.25em;
    font-weight: 800;
  }

  .titre-depenses {
    display: block;
    margin-bottom: 6px;
    font-size: 0.86em;
    font-weight: 700;
    color: var(--texte-2);
  }

  .depense {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 90px 32px;
    gap: 6px;
    margin-bottom: 6px;
  }

  .depense :global(input) {
    min-width: 0;
    width: 100%;
  }

  .depense-lue {
    display: flex;
    justify-content: space-between;
    color: var(--texte-2);
  }

  .ecart {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: var(--ok-pale);
    color: var(--ok);
    border-left: 4px solid var(--ok);
  }

  .ecart strong {
    font-size: 1.3em;
  }

  .ecart.manquant {
    background: var(--danger-pale);
    color: var(--danger);
    border-left-color: var(--danger);
  }

  .ecart.excedent {
    background: var(--alerte-pale);
    color: var(--alerte);
    border-left-color: var(--alerte);
  }

  .avertissement {
    color: var(--alerte);
    font-weight: 600;
    font-size: 0.9em;
  }

  .boutons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rouge {
    color: var(--danger);
  }
</style>
