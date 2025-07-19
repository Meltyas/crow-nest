<script lang="ts">
  import { onDestroy } from 'svelte';
  import { closeResourceEditDialog, dialogStore, handleResourceSave } from '../utils/dialog-manager';
  import ResourceEditDialog from './unified/dialogs/ResourceEditDialog.svelte';

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

<!-- Future global dialogs can be added here -->
<!--
<ReputationEditDialog
  reputation={currentDialogState?.reputationEditDialog?.reputation}
  visible={currentDialogState?.reputationEditDialog?.visible || false}
  on:save={(event) => handleReputationSave(event.detail)}
  on:close={closeReputationEditDialog}
/>
-->
