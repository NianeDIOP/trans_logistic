<script lang="ts">
  import { global } from '../lib/etat.svelte'
  import type { Presentation } from '../lib/types'

  // En-tête des documents (EF-52) : éléments choisis et position du logo, depuis Paramètres → Apparence.
  let { p }: { p: Presentation } = $props()
  const has = (code: string) => p.entete_elements.includes(code)
  const id = $derived(global.identite)
</script>

<div class="doc-entete logo-{p.entete_logo}">
  {#if p.entete_logo !== 'aucun'}
    <div class="doc-logo">{#if global.logo}<img src={global.logo} alt="" />{:else}<span>LOGO</span>{/if}</div>
  {/if}
  <div class="doc-texte">
    {#if has('nom')}<strong>{id?.nom_commercial}</strong>{/if}
    {#if has('slogan') && id?.slogan}<em>{id.slogan}</em>{/if}
    {#if has('coordonnees')}<span>{[id?.adresse, id?.telephones, id?.email].filter(Boolean).join(' · ') || 'Adresse · Téléphones'}</span>{/if}
    {#if has('legal')}<span>NINEA {id?.ninea || '—'} · RC {id?.rc || '—'}</span>{/if}
  </div>
</div>
