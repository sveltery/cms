<script lang="ts">let { relations = [], excludeField }: any = $props();</script>
{#each relations as relation}<section><code>{relation.slug}</code><p>{relation.linkCount} {relation.linkCount === 1 ? 'link' : 'links'}</p>
  {#each relation.boundFields.filter((field: any) => !excludeField || field.collectionSlug !== excludeField.collection || field.fieldSlug !== excludeField.slug) as field}
    <p>the {field.fieldSlug} field on {field.collectionSlug}, which {field.side === 'parent' ? 'picks entries it links to' : 'lists entries that link to it'}</p>
  {/each}
</section>{/each}
