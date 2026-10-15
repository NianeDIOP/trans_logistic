<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import Modale from '../../composants/Modale.svelte'
  import { appel } from '../../lib/api'
  import { global, notifier } from '../../lib/etat.svelte'
  import { dateCourte, fcfa, lireEntier } from '../../lib/format'
  import type { Conditionnement, PrixDate, Produit, ProduitSaisie } from '../../lib/types'

  let {
    produit,
    conditionnements,
    onfermer,
    onenregistre
  }: { produit: Produit | null; conditionnements: Conditionnement[]; onfermer: () => void; onenregistre: () => void } = $props()

  // Formulaire du produit (EF-40), initialisé une fois avec le produit ouvert.
  // `conditionnement` : '' = conditionnement par défaut.
  const initial = untrack(() => produit)
  let saisie = $state({
    nom: initial?.nom ?? '',
    contenance: initial?.contenance ?? '',
    categorie: initial?.categorie ?? 'autre',
    conditionnement: initial?.conditionnement_id?.toString() ?? '',
    bt: String(initial?.bt_par_conditionnement ?? 12),
    seuilDepot: String(initial?.seuil_depot_conditionnements ?? 0),
    seuilBoutique: String(initial?.seuil_boutique_bt ?? 0),
    actif: initial?.actif ?? true,
    // Nouveau prix (facultatif lors d'une modification)
    prix: initial ? '' : '',
    prixAchat: '',
    dateDebut: global.date
  })
  let historique = $state<PrixDate[]>([])
  let erreur = $state('')
  let enCours = $state(false)

  onMount(async () => {
    if (produit) historique = await appel<PrixDate[]>('prix_historique', { produitId: produit.id })
  })

  const defaut = $derived(conditionnements.find((c) => c.par_defaut))
  const choisi = $derived(conditionnements.find((c) => String(c.id) === saisie.conditionnement) ?? defaut)
  const bt = $derived(lireEntier(saisie.bt))

  function entierPositif(v: string, nom: string, min = 0): number {
    const n = lireEntier(v)
    if (n === null || Number.isNaN(n) || n < min) throw new Error(`${nom} : nombre entier attendu${min > 0 ? ` (au moins ${min})` : ''}.`)
    return n
  }

  async function enregistrer(e: Event) {
    e.preventDefault()
    erreur = ''
    enCours = true
    try {
      const s: ProduitSaisie = {
        nom: saisie.nom,
        contenance: saisie.contenance,
        categorie: saisie.categorie,
        conditionnement_id: saisie.conditionnement ? Number(saisie.conditionnement) : null,
        bt_par_conditionnement: entierPositif(saisie.bt, 'Bouteilles par conditionnement', 1),
        seuil_depot_conditionnements: entierPositif(saisie.seuilDepot, 'Seuil du dépôt'),
        seuil_boutique_bt: entierPositif(saisie.seuilBoutique, 'Seuil de la boutique'),
        actif: saisie.actif
      }
      const prix = lireEntier(saisie.prix)
      const achat = lireEntier(saisie.prixAchat)
      if (Number.isNaN(prix) || Number.isNaN(achat)) throw new Error('Les prix doivent être des nombres entiers (FCFA).')
      const id = produit ? produit.id : await appel<number>('produit_ajouter', { saisie: s })
      if (produit) await appel('produit_modifier', { id, saisie: s })
      if (prix !== null) {
        await appel('prix_definir', { produitId: id, dateDebut: saisie.dateDebut, prixVente: prix, prixAchat: achat })
      }
      notifier(produit ? 'Produit enregistré.' : 'Produit ajouté.')
      onenregistre()
    } catch (err) {
      erreur = (err as Error).message
    } finally {
      enCours = false
    }
  }
</script>

<Modale titre={produit ? produit.designation : 'Nouveau produit'} sousTitre="Format, prix et seuils d’alerte" largeur={680} {onfermer}>
  <form id="form-produit" onsubmit={enregistrer}>
    <div class="grille-3">
      <label class="champ" style="grid-column: span 2">
        <span>Nom *</span>
        <input class="saisie" bind:value={saisie.nom} required />
      </label>
      <label class="champ">
        <span>Contenance</span>
        <input class="saisie" bind:value={saisie.contenance} placeholder="3/4, 1/2, 1 L, PM…" />
      </label>
      <label class="champ">
        <span>Catégorie</span>
        <select class="saisie" bind:value={saisie.categorie}>
          {#each global.references?.categories ?? [] as c (c.code)}<option value={c.code}>{c.libelle}</option>{/each}
        </select>
      </label>
      <label class="champ">
        <span>Conditionnement</span>
        <select class="saisie" bind:value={saisie.conditionnement}>
          <option value="">Par défaut ({defaut?.singulier})</option>
          {#each conditionnements.filter((c) => c.actif) as c (c.id)}<option value={String(c.id)}>{c.singulier}</option>{/each}
        </select>
      </label>
      <label class="champ">
        <span>Bouteilles par {choisi?.singulier ?? 'conditionnement'} *</span>
        <input class="saisie nombre" inputmode="numeric" bind:value={saisie.bt} />
        <small>6, 12 ou 24 en général</small>
      </label>
      <label class="champ">
        <span>Seuil d’alerte dépôt</span>
        <input class="saisie nombre" inputmode="numeric" bind:value={saisie.seuilDepot} />
        <small>en {choisi?.pluriel ?? 'conditionnements'}</small>
      </label>
      <label class="champ">
        <span>Seuil d’alerte boutique</span>
        <input class="saisie nombre" inputmode="numeric" bind:value={saisie.seuilBoutique} />
        <small>en bouteilles</small>
      </label>
      <label class="case" style="align-self: center">
        <input type="checkbox" bind:checked={saisie.actif} /> Produit actif
      </label>
    </div>

    <h3 class="titre-prix">{produit ? 'Nouveau prix (facultatif)' : 'Prix de vente'}</h3>
    <div class="grille-3">
      <label class="champ">
        <span>Prix de la bouteille (F)</span>
        <input class="saisie nombre" inputmode="numeric" bind:value={saisie.prix} placeholder={produit?.prix != null ? fcfa(produit.prix) : ''} />
      </label>
      <label class="champ">
        <span>Prix d’achat par {choisi?.singulier ?? 'conditionnement'} (F)</span>
        <input class="saisie nombre" inputmode="numeric" bind:value={saisie.prixAchat} />
        <small>Facultatif (calcul de marge)</small>
      </label>
      <label class="champ">
        <span>Applicable à partir du</span>
        <input class="saisie" type="date" bind:value={saisie.dateDebut} />
      </label>
    </div>

    {#if historique.length}
      <table class="tableau historique">
        <thead><tr><th>Depuis le</th><th class="nb">Prix bouteille</th><th class="nb">Prix d’achat</th></tr></thead>
        <tbody>
          {#each historique as h (h.date_debut)}
            <tr>
              <td>{dateCourte(h.date_debut)}</td>
              <td class="nb">{fcfa(h.prix_vente)} F</td>
              <td class="nb">{h.prix_achat_conditionnement === null ? '—' : `${fcfa(h.prix_achat_conditionnement)} F`}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    {#if bt !== null && !Number.isNaN(bt) && bt > 0}
      <p class="discret exemple">Exemple : {bt * 5 + 3} bouteilles s’afficheront « 5 {choisi?.pluriel ?? ''} + 3 bouteilles ».</p>
    {/if}
    {#if erreur}<p class="erreur-texte">{erreur}</p>{/if}
  </form>

  {#snippet pied()}
    <button class="btn btn-f" onclick={onfermer}>Annuler</button>
    <button class="btn btn-p" form="form-produit" disabled={enCours}>Enregistrer</button>
  {/snippet}
</Modale>

<style>
  .titre-prix {
    margin: 22px 0 10px;
  }

  .historique {
    margin-top: 14px;
  }

  .exemple {
    margin-top: 12px;
  }

  .erreur-texte {
    margin-top: 10px;
  }
</style>
