<script lang="ts">
  import { onDestroy } from 'svelte';
  import { closeResourceEditDialog, closeReputationEditDialog, closePatrolEffectEditDialog, dialogStore, handleResourceSave, handleReputationSave, handlePatrolEffectSave } from '../utils/dialog-manager';
  import ResourceEditDialog from './unified/dialogs/ResourceEditDialog.svelte';
  import ReputationEditDialog from './unified/dialogs/ReputationEditDialog.svelte';
  import PatrolEffectEditDialog from './unified/dialogs/PatrolEffectEditDialog.svelte';

  let currentDialogState: any;

  // Subscribe to dialog store
  const unsubscribe = dialogStore.subscribe(state => {
    currentDialogState = state;
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>

<!-- Global Resource Edit Dialog -->
<ResourceEditDialog
  resource={currentDialogState?.resourceEditDialog?.resource}
  visible={currentDialogState?.resourceEditDialog?.visible || false}
  on:save={(event) => handleResourceSave(event.detail)}
  on:close={closeResourceEditDialog}
/>

<!-- Global Reputation Edit Dialog -->
<ReputationEditDialog
  reputation={currentDialogState?.reputationEditDialog?.reputation}
  visible={currentDialogState?.reputationEditDialog?.visible || false}
  on:save={(event) => handleReputationSave(event.detail)}
  on:close={closeReputationEditDialog}
/>

<!-- Global Patrol Effect Edit Dialog -->
<PatrolEffectEditDialog
  patrolEffect={currentDialogState?.patrolEffectEditDialog?.patrolEffect}
  visible={currentDialogState?.patrolEffectEditDialog?.visible || false}
  on:save={(event) => handlePatrolEffectSave(event.detail)}
  on:close={closePatrolEffectEditDialog}
/>

<!-- Future global dialogs can be added here -->
