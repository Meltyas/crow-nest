<script context="module" lang="ts">
  // Foundry globals
  declare const Dialog: any;
</script>

<script lang="ts">
  import type { GuardStat } from '@/guard/stats';
  import { generateUUID } from '@/utils/log';
  import { createEventDispatcher } from 'svelte';

  export let stats: GuardStat[] = [];
  export let editing = false;
  export let getTotalStatValue: (stat: GuardStat) => number;

  const dispatch = createEventDispatcher();

  let addingStat = false;
  let newStat: GuardStat = { key: '', name: '', value: 0 };

  function openAddStat() {
    newStat = { key: generateUUID(), name: '', value: 0 };
    addingStat = true;
  }

  function confirmAddStat() {
    dispatch('addStat', { ...newStat });
    addingStat = false;
  }

  function cancelAddStat() {
    addingStat = false;
  }

  function removeStat(index: number) {
    const stat = stats[index];
    const statName = stat?.name || 'stat sin nombre';

    // Use Foundry's Dialog system for confirmation
    if (typeof Dialog !== 'undefined') {
      new Dialog({
        title: "Eliminar Stat",
        content: `<p>¿Estás seguro de que quieres eliminar el stat "<strong>${statName}</strong>"?</p><p><strong>Esta acción no se puede deshacer.</strong></p>`,
        buttons: {
          yes: {
            icon: '<i class="fas fa-trash"></i>',
            label: "Sí, eliminar",
            callback: () => {
              dispatch('removeStat', index);
            }
          },
          no: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancelar"
          }
        },
        default: "no"
      }).render(true);
    } else {
      // Fallback to confirm if Dialog is not available
      if (confirm(`¿Estás seguro de que quieres eliminar el stat "${statName}"?`)) {
        dispatch('removeStat', index);
      }
    }
  }

  function updateStat() {
    dispatch('updateStat');
  }

  function onImageClick(stat: GuardStat) {
    if (editing) {
      // In edit mode, handle image selection
      dispatch('imageClick', stat);
    } else {
      // In view mode, open roll dialog
      rollStat(stat);
    }
  }

  function onFileChange(stat: GuardStat, event: Event) {
    dispatch('fileChange', { stat, event });
  }

  function toggleEditing() {
    dispatch('toggleEditing');
  }

  function rollStat(stat: GuardStat) {
    dispatch('rollStat', stat);
  }
</script>

<div class="stats-section">
  <div class="button-holder">
    {#if editing}
      <button on:click={openAddStat}>Añadir Stat</button>
    {/if}
    <button on:click={toggleEditing}>{editing ? 'Stop Editing' : 'Edit Stats'}</button>
  </div>

  {#if addingStat}
    <div class="add-stat-form">
      <input placeholder="Nombre" bind:value={newStat.name} />
      <input type="number" placeholder="Valor" bind:value={newStat.value} />
      <button on:click={confirmAddStat}>Agregar</button>
      <button on:click={cancelAddStat}>Cancelar</button>
    </div>
  {/if}

  <div class="stat-container">
    {#each stats as stat, i}
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="stat {!editing ? 'clickable-stat' : ''}" on:click={!editing ? () => rollStat(stat) : undefined} on:keydown={!editing ? (e) => e.key === 'Enter' && rollStat(stat) : undefined} tabindex={!editing ? "0" : undefined}>
        <button class="stat-img" on:click={(e) => { e.stopPropagation(); onImageClick(stat); }}>
          <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt="stat" />
        </button>
        <input
          id={`file-${stat.key}`}
          type="file"
          accept="image/*"
          on:change={(e) => onFileChange(stat, e)}
          style="display: none;"
        />
        {#if editing}
          <div class="stats-editables">
            <input
              class="stat-name-input"
              placeholder="Nombre"
              bind:value={stat.name}
              on:change={updateStat}
            />
          </div>
          <div class="stat-number">
            <input
              class="stat-number-input"
              type="number"
              placeholder="Valor"
              bind:value={stat.value}
              on:change={updateStat}
            />
            <button class="stat-number-close" on:click={() => removeStat(i)}>X</button>
          </div>
        {:else}
          <div class="stat-view">
            <div class="stat-name">{stat.name}</div>
            <div class="stat-value">{stat.value} ({getTotalStatValue(stat)})</div>
            <div class="roll-hint">Click to roll</div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .stats-section {
    flex: 0 0 60%;
    min-width: 60%;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.25rem;
    flex: 1 1 0;
    min-width: 0;
    max-width: none;
    box-sizing: border-box;
  }

  .stat img {
    height: 42px;
    width: 42px;
  }

  .stat-img {
    background: none;
    border: none;
    padding: 0;
    height: 42px;
    width: 42px;
    cursor: pointer;
  }

  .stat-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    flex-wrap: wrap;
  }

  .button-holder {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .stats-editables {
    display: flex;
    gap: 0.25rem;
  }

  .stat-name-input {
    max-width: 100px;
    text-align: center;
  }

  .stat-number {
    display: flex;
  }

  .stat-number-input {
    width: 30px;
    text-align: center;
  }

  .stat-number-close {
    width: 24px;
    text-align: center;
  }

  .stat-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-weight: bold;
  }

  .stat-value {
    display: flex;
    align-items: center;
    font-size: 1rem;
    font-weight: bold;
  }

  .stat-name {
    font-size: 0.8rem;
  }

  .stat-view.clickable {
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 4px;
    padding: 0.25rem;
    position: relative;
  }

  .stat-view.clickable:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .stat-view.clickable:active {
    transform: translateY(0);
  }

  .roll-hint {
    font-size: 0.7rem;
    color: #888;
    opacity: 0;
    transition: opacity 0.2s ease;
    text-align: center;
    margin-top: 2px;
  }

  .stat-view.clickable:hover .roll-hint {
    opacity: 1;
  }

  .stat.clickable-stat {
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px;
    padding: 0.25rem;
  }

  .stat.clickable-stat:hover {
    background-color: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .stat.clickable-stat:active {
    transform: translateY(0);
  }

  .stat.clickable-stat:hover .roll-hint {
    opacity: 1;
  }

  .standard-image {
    width: 32px;
    height: 32px;
  }
</style>
