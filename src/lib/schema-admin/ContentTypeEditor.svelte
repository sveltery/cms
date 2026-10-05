<script lang="ts">
  let { collection, isNew = false, onSave, fieldEditor, client }: any = $props();
</script>
<h1>{isNew ? 'New Content Type' : collection?.label}</h1>
