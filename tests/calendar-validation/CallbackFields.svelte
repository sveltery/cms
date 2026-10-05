<script lang="ts">
  // Finite typed field-callback host for invalid values that the normal widget
  // prevents. The actual production dialog and serializer remain unchanged.
  let {onDateChange,onTimeChange}:{onDateChange:(date:Date)=>void;onTimeChange:(time:string)=>void}=$props();
</script>
<button type="button" data-invalid-date onclick={()=>{onDateChange(new Date(Number.NaN));onTimeChange('09:00');}}>Invalid date fixture</button>
<button type="button" data-invalid-time onclick={()=>{onDateChange(new Date(2035,5,15,12));onTimeChange('25:00');}}>Invalid time fixture</button>
