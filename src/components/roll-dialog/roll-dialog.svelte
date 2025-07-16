<script lang="ts">
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import type { Group } from '@/shared/group';
  import { createEventDispatcher } from 'svelte';
  import RollDialogPopup from './roll-dialog-popup.svelte';

  export let isOpen = false;
  export let stat: GuardStat | null = null;
  export let group: Group | null = null;
  export let baseValue = 0;
  export let totalModifier = 0;
  export let guardModifiers: GuardModifier[] = [];

  const dispatch = createEventDispatcher();

  function handleClose() {
    isOpen = false;
    dispatch('close');
  }
</script>

<RollDialogPopup
  {isOpen}
  {stat}
  {group}
  {baseValue}
  {totalModifier}
  {guardModifiers}
  on:close={handleClose}
/>
