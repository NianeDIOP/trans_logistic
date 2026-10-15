<script lang="ts">
  import { onMount } from 'svelte'
  import { appel } from '../../lib/api'

  let infos = $state<{ version: string; version_schema: number } | null>(null)
  onMount(async () => (infos = await appel('infos_app')))
</script>

<section class="carte apropos">
  <img src="/icone.svg" alt="" width="72" height="72" />
  <div>
    <h2>Gestion Dépôt et Boutique</h2>
    <p>Stock du dépôt et de la boutique, fiche journalière du vendeur et caisse du jour. Fonctionne entièrement hors connexion.</p>
    <dl>
      <dt>Version</dt>
      <dd>{infos?.version ?? '…'}</dd>
      <dt>Base de données</dt>
      <dd>schéma n° {infos?.version_schema ?? '…'}</dd>
      <dt>Conception</dt>
      <dd>Niane Diop · 77 158 89 03</dd>
    </dl>
  </div>
</section>

<style>
  .apropos {
    display: flex;
    gap: 22px;
    max-width: 720px;
  }

  .apropos p {
    margin-top: 6px;
    color: var(--texte-2);
  }

  dl {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 6px 12px;
    margin-top: 16px;
  }

  dt {
    color: var(--texte-3);
    font-weight: 700;
  }

  dd {
    font-weight: 600;
  }
</style>
