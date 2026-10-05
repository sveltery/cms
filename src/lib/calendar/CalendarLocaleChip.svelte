<script lang="ts">
  // EmDash CalendarLocaleChip, pin913cb1bb; MIT notices/emdash-MIT.txt.
  import { getLocaleLabel } from '../ui/locales/config.ts';
  let { locale }: { locale:string }=$props();
</script>
<span class="locale-chip"><span aria-hidden="true">{locale}</span><span class="locale-name">{getLocaleLabel(locale)}</span></span>
<style>.locale-chip{display:inline-block;flex-shrink:0;font-size:.625rem;font-weight:600;text-transform:uppercase;letter-spacing:.025em;}.locale-name{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);text-transform:none;}</style>
