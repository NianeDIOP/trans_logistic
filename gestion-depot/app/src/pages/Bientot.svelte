<script lang="ts">
  import { Hourglass } from '@lucide/svelte'
  import EnTete from '../composants/EnTete.svelte'
  import type { Page } from '../lib/etat.svelte'

  let { page }: { page: Page } = $props()

  const TEXTES: Partial<Record<Page, { titre: string; texte: string; lot: string }>> = {
    fiche: {
      titre: 'Fiche du jour',
      texte: 'Saisie de la fiche du vendeur, calculs des ventes, contrôles et caisse du jour.',
      lot: 'Lot 3'
    },
    depot: {
      titre: 'Dépôt',
      texte: 'Réceptions fournisseur, alimentations de la boutique, inventaires et fiche de stock.',
      lot: 'Lot 2'
    },
    historique: {
      titre: 'Historique et rapports',
      texte: 'Journées enregistrées, encaissements, ventes par produit, impressions et export Excel.',
      lot: 'Lot 4'
    }
  }
  const t = $derived(TEXTES[page] ?? { titre: 'Module', texte: '', lot: '' })
</script>

<EnTete titre={t.titre} sousTitre={t.texte} />
<div class="carte vide">
  <Hourglass size={40} strokeWidth={1.6} />
  <p><strong>Module en cours de développement</strong> ({t.lot}).</p>
  <p class="discret">Les règles et la base de données sont déjà prêtes ; l’écran arrive dans la prochaine livraison.</p>
</div>

<style>
  .vide {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
</style>
