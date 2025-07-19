<script context="module" lang="ts">
  // Foundry globals
  declare const game: any;
</script>

<script lang="ts">
  import Tooltip from '@/components/tooltip.svelte';
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { createEventDispatcher } from 'svelte';
  import SituationalModifierDialog from './situational-modifier-dialog.svelte';

  export let modifiers: GuardModifier[] = [];
  export let stats: GuardStat[] = [];
  export let editingMods = false;

  const dispatch = createEventDispatcher();

  let dialogOpen = false;
  let dialogModifier: GuardModifier | null = null;

  // Safe access to game object
  let isGM = false;
  $: {
    try {
      isGM = typeof (window as any).game !== 'undefined' && (window as any).game.user?.isGM;
    } catch {
      isGM = false;
    }
  }

  function openAddModifier() {
    dialogModifier = null;
    dialogOpen = true;
  }

  function openEditModifier(modifier: GuardModifier) {
    dialogModifier = modifier;
    dialogOpen = true;
  }

  function removeModifier(index: number) {
    dispatch('removeModifier', index);
  }

  function handleCreateModifier(event: CustomEvent) {
    dispatch('addModifier', event.detail);
    dialogOpen = false;
    dialogModifier = null;
  }

  function handleUpdateModifier(event: CustomEvent) {
    const updatedModifier = event.detail;
    const index = modifiers.findIndex(m => m.key === updatedModifier.key);
    if (index !== -1) {
      dispatch('updateModifier', { index, modifier: updatedModifier });
    }
    dialogOpen = false;
    dialogModifier = null;
  }

  function handleDialogClose() {
    dialogOpen = false;
    dialogModifier = null;
  }

  function handleCreatePreset(event: CustomEvent) {
    const modifier = event.detail;
    console.log('ModifiersSection - Received createPreset event:', modifier);
    // Dispatch preset creation to parent component
    dispatch('createPresetFromModifier', modifier);
    // Dialog will close automatically after preset creation
    dialogOpen = false;
    dialogModifier = null;
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

  function createPresetFromSituationalModifier(mod: GuardModifier) {
    const item = {
      sourceId: mod.sourceId || mod.key, // Use sourceId first, fallback to key
      name: mod.name,
      description: mod.description || '',
      situation: mod.description || 'Situación específica',
      img: mod.img || 'icons/svg/upgrade.svg',
      statEffects: { ...mod.mods } // Deep copy the mods object
    };
    console.log('ModifierSection - Enviando objeto al crear preset:', item);
    console.log('ModifierSection - Modificador original:', mod);
    console.log('ModifierSection - statEffects específicamente:', mod.mods);
    dispatch('createPresetFromSituationalModifier', item);
  }
</script>

<div class="modifiers-section">
  <h4>Modificaciones Situacionales</h4>
  {#if editingMods}
    <button on:click={openAddModifier}>Añadir Modificador</button>
  {/if}
  <button on:click={toggleEditingMods}>{editingMods ? 'Stop Edit Mods' : 'Edit Mods'}</button>

  <div class="modifier-container">
    {#each modifiers as mod, i}
      <div class="modifier modifier-{mod.state || 'neutral'}">
        <Tooltip
          content={editingMods ? `<p><strong>${mod.name}:</strong> ${mod.description ?? ''}</p>` : modTooltip(mod)}
          size="42px"
        >
          <button
            type="button"
            class="image-button"
            on:click={() => editingMods ? openEditModifier(mod) : null}
          >
            <img class="standard-image" src={mod.img || 'icons/svg/upgrade.svg'} alt="mod" />
          </button>
        </Tooltip>
        {#if editingMods}
          <div class="modifier-buttons">
            {#if isGM}
              <button class="preset-button" on:click={() => createPresetFromSituationalModifier(mod)} title="Crear preset con este modificador">Preset</button>
            {/if}
            <button class="remove-button" on:click={() => removeModifier(i)}>X</button>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Dialog Component -->
  <SituationalModifierDialog
    bind:isOpen={dialogOpen}
    {stats}
    modifier={dialogModifier}
    on:create={handleCreateModifier}
    on:update={handleUpdateModifier}
    on:createPreset={handleCreatePreset}
    on:close={handleDialogClose}
  />
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

  .modifier {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    border: 2px solid transparent;
    border-radius: 4px;
    position: relative;
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

  .modifier-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .modifier-buttons {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.25rem;
    position: absolute;
    bottom: -30px;
    background: rgba(0, 0, 0, 0.8);
    padding: 2px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .modifier:hover .modifier-buttons {
    opacity: 1;
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
    font-size: 0.8em;
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
    font-size: 0.8em;
  }

  .remove-button:hover {
    background: #b91c1c;
  }

  .standard-image {
    width: 32px;
    height: 32px;
  }

  .image-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .image-button:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
</style>
