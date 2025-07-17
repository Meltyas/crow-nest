<script lang="ts">
  import Tooltip from '@/components/tooltip.svelte';
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { generateUUID } from '@/utils/log';
  import { createEventDispatcher } from 'svelte';

  export let modifiers: GuardModifier[] = [];
  export let stats: GuardStat[] = [];
  export let editingMods = false;

  const dispatch = createEventDispatcher();

  let addingModifier = false;
  let newModifier: GuardModifier = {
    key: '',
    name: '',
    description: '',
    mods: {},
    state: 'neutral',
    img: 'icons/svg/upgrade.svg'
  };

  function openAddModifier() {
    newModifier = {
      key: generateUUID(),
      name: '',
      description: '',
      mods: {},
      state: 'neutral',
      img: 'icons/svg/upgrade.svg'
    };
    addingModifier = true;
  }

  function cancelAddModifier() {
    addingModifier = false;
  }

  function confirmAddModifier() {
    dispatch('addModifier', { ...newModifier });
    addingModifier = false;
  }

  function removeModifier(index: number) {
    dispatch('removeModifier', index);
  }

  function updateModifier() {
    dispatch('updateModifier');
  }

  function onModImageClick(mod: GuardModifier) {
    dispatch('modImageClick', mod);
  }

  function onNewModImageClick() {
    dispatch('newModImageClick', newModifier);
  }

  function onModFileChange(mod: GuardModifier, event: Event) {
    dispatch('modFileChange', { mod, event });
  }

  function toggleEditingMods() {
    dispatch('toggleEditingMods');
  }

  function modTooltip(mod: GuardModifier): string {
    const header = `<p><strong>${mod.name}:</strong> ${mod.description ?? ''}</p>`;
    const mods = Object.entries(mod.mods)
      .map(([k, v]) => {
        const stat = stats.find((s) => s.key === k);
        if (!stat) return '';
        const val = Number(v) > 0 ? `+${v}` : `${v}`;
        return `<div style="display:flex;align-items:center;gap:0.25rem;">
          <img src="${stat.img || 'icons/svg/shield.svg'}" alt="${stat.name}" width="16" height="16" />
          <span>${val}</span>
        </div>`;
      })
      .filter(Boolean)
      .join('');
    return header + mods;
  }

  function createPresetFromModifier(mod: GuardModifier) {
    dispatch('createPresetFromModifier', mod);
  }
</script>

<div class="modifiers-section">
  <h4>Modificaciones Situacionales</h4>
  {#if editingMods}
    <button on:click={openAddModifier}>Añadir Modificador</button>
  {/if}
  <button on:click={toggleEditingMods}>{editingMods ? 'Stop Edit Mods' : 'Edit Mods'}</button>

  {#if addingModifier}
    <div class="add-mod-form">
      <div class="modifier-image-section">
        <button type="button" class="modifier-image-button" on:click={onNewModImageClick}>
          <img src={newModifier.img} alt="" />
        </button>
      </div>
      <input placeholder="Nombre" bind:value={newModifier.name} />
      <textarea placeholder="Descripción" bind:value={newModifier.description}></textarea>
      <div class="state-selector">
        <label for="new-modifier-state">Estado:</label>
        <select id="new-modifier-state" bind:value={newModifier.state}>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
      </div>
      <div class="modifier-stats-container">
        {#each stats as stat}
          <div class="modifier-values">
            <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} width="32" height="32" />
            <input type="number" bind:value={newModifier.mods[stat.key]} />
          </div>
        {/each}
      </div>
      <div class="form-buttons">
        <button on:click={confirmAddModifier}>Agregar</button>
        <button on:click={cancelAddModifier}>Cancelar</button>
      </div>
    </div>
  {/if}

  <div class="modifier-container">
    {#each modifiers as mod, i}
      <div class="modifier modifier-{mod.state || 'neutral'}">
        <Tooltip
          content={editingMods ? `<p><strong>${mod.name}:</strong> ${mod.description ?? ''}</p>` : modTooltip(mod)}
          size="42px"
        >
          <button type="button" class="image-button" on:click={() => onModImageClick(mod)}>
            <img class="standard-image" src={mod.img || 'icons/svg/upgrade.svg'} alt="mod" />
          </button>
        </Tooltip>
        <input id={`mod-file-${mod.key}`} type="file" accept="image/*" style="display:none" on:change={(e)=>onModFileChange(mod,e)} />
        {#if editingMods}
          <div class="modifier-edit">
            <input placeholder="Nombre" bind:value={mod.name} on:change={updateModifier} />
            <textarea placeholder="Descripción" bind:value={mod.description} on:change={updateModifier} />
            <div class="state-selector">
              <label for="edit-modifier-state-{i}">Estado:</label>
              <select id="edit-modifier-state-{i}" bind:value={mod.state} on:change={updateModifier}>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
            <div class="modifier-values-contain">
              {#each stats as stat}
                <div class="modifier-values modifier-values-edit">
                  <img class="standard-image" src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} width="16" height="16" />
                  <input type="number" bind:value={mod.mods[stat.key]} on:change={updateModifier} />
                </div>
              {/each}
            </div>
            <div class="modifier-buttons">
              <button class="preset-button" on:click={() => createPresetFromModifier(mod)} title="Crear preset con este modificador">Preset</button>
              <button class="remove-button" on:click={() => removeModifier(i)}>X</button>
            </div>
          </div>
        {:else}
          <!-- content moved into tooltip -->
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .modifiers-section {
    flex: 1;
    min-width: 35%;
  }

  .modifiers-section h4 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }

  .modifier-image-section {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .modifier-image-button {
    background: none;
    border: 2px solid #666;
    border-radius: 4px;
    padding: 0;
    cursor: pointer;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modifier-image-button:hover {
    border-color: #4a90e2;
  }

  .modifier-image-button img {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 2px;
  }

  .modifier-stats-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin: 0.5rem 0;
  }

  .form-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.5rem;
  }

  .modifier {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    border: 2px solid transparent;
    border-radius: 4px;
  }

  .modifier .standard-image {
    background: #000000;
    width: 42px;
    height: 42px;
  }

  .modifier-positive {
    border: solid 2px #22c55e; /* Green border for positive */
  }

  .modifier-neutral {
    border: solid 2px #ffffff; /* White border for neutral */
  }

  .modifier-negative {
    border: solid 2px #ef4444; /* Red border for negative */
  }

  .state-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.5rem 0;
  }

  .state-selector label {
    font-weight: bold;
    min-width: 50px;
  }

  .state-selector select {
    padding: 0.25rem;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: white;
    font-size: 0.9em;
  }

  .modifier-values {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .modifier-values input {
    width: 32px;
    height: 32px;
    text-align: center;
    border: 1px solid #ccc;
    border-radius: 3px;
  }

  .modifier-values-edit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .modifier-values-edit input {
    height: 32px;
    width: 32px;
  }

  .modifier-edit {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .modifier-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .modifier-values-contain {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .modifier-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .preset-button {
    background: #d4af37;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: 'Overpass', Arial, sans-serif;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .preset-button:hover {
    background: #b8941f;
  }

  .remove-button {
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: 'Overpass', Arial, sans-serif;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .remove-button:hover {
    background: #b91c1c;
  }

  .standard-image {
    width: 32px;
    height: 32px;
  }
</style>
