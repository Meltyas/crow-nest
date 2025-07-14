<script lang="ts">
  import type { GuardResource } from '@/guard/stats';
  import { createEventDispatcher } from 'svelte';

  export let resources: GuardResource[] = [];
  export let editingResources = false;

  const dispatch = createEventDispatcher();

  let addingResource = false;
  let newResource: GuardResource = { key: '', name: '', value: 0 };

  function toggleEditingResources() {
    dispatch('toggleEditingResources');
  }

  function openAddResource() {
    newResource = { key: crypto.randomUUID(), name: '', value: 0 };
    addingResource = true;
  }

  function cancelAddResource() {
    addingResource = false;
  }

  function confirmAddResource() {
    dispatch('addResource', { ...newResource });
    addingResource = false;
  }

  function removeResource(index: number) {
    dispatch('removeResource', index);
  }

  function updateResource() {
    dispatch('updateResource');
  }

  function onResImageClick(res: GuardResource) {
    if (editingResources) {
      dispatch('resImageClick', res);
    }
  }

  function onResFileChange(res: GuardResource, event: Event) {
    dispatch('resFileChange', { res, event });
  }
</script>

<div class="resources-section">
  <h3 style="display: flex; justify-content: space-between; align-items: center;">
    Recursos
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <button class="edit-button small-button" on:click={toggleEditingResources}>
        ✏️ {editingResources ? 'Finalizar' : 'Editar'}
      </button>
      <button class="add-button small-button" on:click={openAddResource}>➕ Añadir</button>
    </div>
  </h3>

  {#if addingResource}
    <div class="add-resource-form">
      <input placeholder="Nombre" bind:value={newResource.name} />
      <input type="number" bind:value={newResource.value} />
      <button on:click={confirmAddResource}>Agregar</button>
      <button on:click={cancelAddResource}>Cancelar</button>
    </div>
  {/if}

  <div class="resource-container">
    {#each resources as res, i}
      <div class="resource">
        <button type="button" class="image-button" on:click={() => onResImageClick(res)}>
          <img class="standard-image" src={res.img || 'icons/svg/item-bag.svg'} alt="res" />
        </button>
        <input id={`res-file-${res.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onResFileChange(res,e)} />

        {#if editingResources}
          <input placeholder="Nombre" bind:value={res.name} on:change={updateResource} />
          <input type="number" bind:value={res.value} on:change={updateResource} />
          <button on:click={() => removeResource(i)}>✕</button>
        {:else}
          <div>
            <span>{res.name}</span>
            <span>{res.value}</span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .resource {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .resource-container {
    display: flex;
    gap: 0.25rem;
  }

  .standard-image {
    width: 32px;
    height: 32px;
  }
</style>
