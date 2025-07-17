<script lang="ts">
  // FilePicker is provided by Foundry at runtime
  declare const FilePicker: any;

  import { getStats } from '@/guard/stats';
  import type { PresetCollection, PresetItem } from '@/shared/preset';
  import { addPreset, initializePresets, presetsStore, removePreset, updatePresetUsage } from '@/stores/presets';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  const dispatch = createEventDispatcher();

  export let visible = false;
  export let initialPosition: { x: number; y: number } | undefined = undefined;

  let presets: PresetCollection = {
    resources: [],
    reputations: [],
    temporaryModifiers: [],
    situationalModifiers: []
  };

  let stats = getStats();

  let activeTab: 'resources' | 'reputations' | 'temporaryModifiers' | 'situationalModifiers' = 'resources';
  let popupElement: HTMLElement;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let position = initialPosition || { x: 100, y: 100 };

  // Formularios para crear nuevos presets
  let newResourceForm = {
    name: '',
    value: 0,
    description: '',
    img: ''
  };

  let newReputationForm = {
    name: '',
    value: 0,
    description: '',
    img: ''
  };

  let newTemporaryModifierForm = {
    name: '',
    description: '',
    type: 'buff',
    value: 0,
    duration: '1 turno',
    statEffects: {}
  };

  let newSituationalModifierForm = {
    name: '',
    description: '',
    modifier: 0,
    situation: '',
    img: ''
  };

  let showCreateForm = false;
  let editingPreset: PresetItem | null = null;
  let editingPresetType: 'resource' | 'reputation' | 'temporaryModifier' | 'situationalModifier' | null = null;

  onMount(async () => {
    await initializePresets();

    presetsStore.subscribe(value => {
      presets = value;
    });

    // Posicionar popup
    if (popupElement && initialPosition) {
      popupElement.style.left = `${initialPosition.x}px`;
      popupElement.style.top = `${initialPosition.y}px`;
    }
  });

  onDestroy(() => {
    // Cleanup handled by store subscription
  });

  function handleClose() {
    visible = false;
    dispatch('close');
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.target === popupElement.querySelector('.popup-header') ||
        popupElement.querySelector('.popup-header')?.contains(event.target as Node)) {
      isDragging = true;
      const rect = popupElement.getBoundingClientRect();
      dragOffset = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging && popupElement) {
      const newX = event.clientX - dragOffset.x;
      const newY = event.clientY - dragOffset.y;

      position = { x: newX, y: newY };
      popupElement.style.left = `${newX}px`;
      popupElement.style.top = `${newY}px`;

      dispatch('positionChange', position);
    }
  }

  function handleMouseUp() {
    isDragging = false;
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function saveOrCreatePreset(type: 'resource' | 'reputation' | 'temporaryModifier' | 'situationalModifier') {
    if (editingPreset && editingPresetType === type) {
      // We're editing an existing preset
      saveEdit();
      return;
    }

    // We're creating a new preset
    let preset: PresetItem;
    
    if (type === 'resource') {
      if (!newResourceForm.name.trim()) return;
      preset = {
        id: generateId(),
        name: newResourceForm.name,
        type: 'resource',
        description: newResourceForm.description,
        data: {
          name: newResourceForm.name,
          value: newResourceForm.value,
          description: newResourceForm.description,
          img: newResourceForm.img
        },
        createdAt: Date.now()
      };
    } else if (type === 'reputation') {
      if (!newReputationForm.name.trim()) return;
      preset = {
        id: generateId(),
        name: newReputationForm.name,
        type: 'reputation',
        description: newReputationForm.description,
        data: {
          name: newReputationForm.name,
          value: newReputationForm.value,
          description: newReputationForm.description,
          img: newReputationForm.img
        },
        createdAt: Date.now()
      };
    } else if (type === 'temporaryModifier') {
      if (!newTemporaryModifierForm.name.trim()) return;
      preset = {
        id: generateId(),
        name: newTemporaryModifierForm.name,
        type: 'temporaryModifier',
        description: newTemporaryModifierForm.description,
        data: {
          name: newTemporaryModifierForm.name,
          description: newTemporaryModifierForm.description,
          type: newTemporaryModifierForm.type,
          value: newTemporaryModifierForm.value,
          duration: newTemporaryModifierForm.duration,
          statEffects: newTemporaryModifierForm.statEffects
        },
        createdAt: Date.now()
      };
    } else if (type === 'situationalModifier') {
      if (!newSituationalModifierForm.name.trim()) return;
      preset = {
        id: generateId(),
        name: newSituationalModifierForm.name,
        type: 'situationalModifier',
        description: newSituationalModifierForm.description,
        data: {
          name: newSituationalModifierForm.name,
          description: newSituationalModifierForm.description,
          modifier: newSituationalModifierForm.modifier,
          situation: newSituationalModifierForm.situation,
          img: newSituationalModifierForm.img
        },
        createdAt: Date.now()
      };
    }

    addPreset(preset);

    // Reset form
    if (type === 'resource') {
      newResourceForm = { name: '', value: 0, description: '', img: '' };
    } else if (type === 'reputation') {
      newReputationForm = { name: '', value: 0, description: '', img: '' };
    } else if (type === 'temporaryModifier') {
      newTemporaryModifierForm = { name: '', description: '', type: 'buff', value: 0, duration: '1 turno', statEffects: {} };
    } else if (type === 'situationalModifier') {
      newSituationalModifierForm = { name: '', description: '', modifier: 0, situation: '', img: '' };
    }
    
    showCreateForm = false;
  }

  function createResourcePreset() {
    saveOrCreatePreset('resource');
  }

  function createReputationPreset() {
    saveOrCreatePreset('reputation');
  }

  function createTemporaryModifierPreset() {
    saveOrCreatePreset('temporaryModifier');
  }

  function createSituationalModifierPreset() {
    saveOrCreatePreset('situationalModifier');
  }

  function usePreset(preset: PresetItem) {
    updatePresetUsage(preset.id, preset.type);
    dispatch('usePreset', preset);
  }

  function deletePreset(preset: PresetItem) {
    if (confirm(`¿Seguro que quieres eliminar el preset "${preset.name}"?`)) {
      removePreset(preset.id, preset.type);
    }
  }

  function editPreset(preset: PresetItem) {
    editingPreset = preset;
    editingPresetType = preset.type;
    
    // Switch to the correct tab
    if (preset.type === 'resource') {
      activeTab = 'resources';
    } else if (preset.type === 'reputation') {
      activeTab = 'reputations';
    } else if (preset.type === 'temporaryModifier') {
      activeTab = 'temporaryModifiers';
    } else if (preset.type === 'situationalModifier') {
      activeTab = 'situationalModifiers';
    }
    
    // Populate form based on preset type
    if (preset.type === 'resource') {
      newResourceForm = {
        name: preset.data.name,
        value: preset.data.value,
        description: preset.data.description || '',
        img: preset.data.img || ''
      };
    } else if (preset.type === 'reputation') {
      newReputationForm = {
        name: preset.data.name,
        value: preset.data.value,
        description: preset.data.description || '',
        img: preset.data.img || ''
      };
    } else if (preset.type === 'temporaryModifier') {
      newTemporaryModifierForm = {
        name: preset.data.name,
        description: preset.data.description || '',
        type: preset.data.type,
        value: preset.data.value,
        duration: preset.data.duration,
        statEffects: { ...preset.data.statEffects }
      };
    } else if (preset.type === 'situationalModifier') {
      newSituationalModifierForm = {
        name: preset.data.name,
        description: preset.data.description || '',
        modifier: preset.data.modifier,
        situation: preset.data.situation,
        img: preset.data.img || ''
      };
    }
    
    showCreateForm = true;
  }

  function cancelEdit() {
    editingPreset = null;
    editingPresetType = null;
    showCreateForm = false;
    
    // Reset forms
    newResourceForm = { name: '', value: 0, description: '', img: '' };
    newReputationForm = { name: '', value: 0, description: '', img: '' };
    newTemporaryModifierForm = { name: '', description: '', type: 'buff', value: 0, duration: '1 turno', statEffects: {} };
    newSituationalModifierForm = { name: '', description: '', modifier: 0, situation: '', img: '' };
  }

  function saveEdit() {
    if (!editingPreset) return;

    // Update the preset with new data
    const updatedPreset = {
      ...editingPreset,
      data: editingPreset.type === 'resource' ? {
        name: newResourceForm.name,
        value: newResourceForm.value,
        description: newResourceForm.description,
        img: newResourceForm.img
      } : editingPreset.type === 'reputation' ? {
        name: newReputationForm.name,
        value: newReputationForm.value,
        description: newReputationForm.description,
        img: newReputationForm.img
      } : editingPreset.type === 'temporaryModifier' ? {
        name: newTemporaryModifierForm.name,
        description: newTemporaryModifierForm.description,
        type: newTemporaryModifierForm.type,
        value: newTemporaryModifierForm.value,
        duration: newTemporaryModifierForm.duration,
        statEffects: newTemporaryModifierForm.statEffects
      } : editingPreset.type === 'situationalModifier' ? {
        name: newSituationalModifierForm.name,
        description: newSituationalModifierForm.description,
        modifier: newSituationalModifierForm.modifier,
        situation: newSituationalModifierForm.situation,
        img: newSituationalModifierForm.img
      } : editingPreset.data
    };

    // Update name at preset level too
    updatedPreset.name = updatedPreset.data.name;
    updatedPreset.description = updatedPreset.data.description || '';

    // Remove old preset and add updated one
    removePreset(editingPreset.id, editingPreset.type);
    addPreset(updatedPreset);

    // Clear editing state
    cancelEdit();
  }

  function addStatEffect(statKey: string, value: number) {
    newTemporaryModifierForm.statEffects[statKey] = value;
    newTemporaryModifierForm = { ...newTemporaryModifierForm };
  }

  function removeStatEffect(statKey: string) {
    delete newTemporaryModifierForm.statEffects[statKey];
    newTemporaryModifierForm = { ...newTemporaryModifierForm };
  }

  // Functions to open Foundry image picker
  function openImagePicker(type: 'resource' | 'reputation' | 'situational') {
    if (typeof FilePicker === 'undefined') {
      console.error('FilePicker not available');
      return;
    }

    new FilePicker({
      type: 'image',
      current: type === 'resource' ? newResourceForm.img :
               type === 'reputation' ? newReputationForm.img :
               newSituationalModifierForm.img,
      callback: (path: string) => {
        if (type === 'resource') {
          newResourceForm.img = path;
          newResourceForm = { ...newResourceForm };
        } else if (type === 'reputation') {
          newReputationForm.img = path;
          newReputationForm = { ...newReputationForm };
        } else if (type === 'situational') {
          newSituationalModifierForm.img = path;
          newSituationalModifierForm = { ...newSituationalModifierForm };
        }
      },
      top: popupElement?.offsetTop || 100,
      left: popupElement?.offsetLeft || 100
    }).render(true);
  }
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

{#if visible}
  <div
    class="presets-popup-overlay"
    on:click={handleClose}
  >
    <div
      class="presets-popup"
      bind:this={popupElement}
      on:mousedown={handleMouseDown}
      on:click|stopPropagation
      style="left: {position.x}px; top: {position.y}px;"
    >
      <!-- Header -->
      <div class="popup-header">
        <h2>Presets Manager</h2>
        <button class="close-button" on:click={handleClose}>×</button>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button
          class="tab {activeTab === 'resources' ? 'active' : ''}"
          on:click={() => { activeTab = 'resources'; if (!editingPreset) showCreateForm = false; }}
        >
          Recursos
        </button>
        <button
          class="tab {activeTab === 'reputations' ? 'active' : ''}"
          on:click={() => { activeTab = 'reputations'; if (!editingPreset) showCreateForm = false; }}
        >
          Reputaciones
        </button>
        <button
          class="tab {activeTab === 'temporaryModifiers' ? 'active' : ''}"
          on:click={() => { activeTab = 'temporaryModifiers'; if (!editingPreset) showCreateForm = false; }}
        >
          Mod. Temporales
        </button>
        <button
          class="tab {activeTab === 'situationalModifiers' ? 'active' : ''}"
          on:click={() => { activeTab = 'situationalModifiers'; if (!editingPreset) showCreateForm = false; }}
        >
          Mod. Situacionales
        </button>
      </div>

      <!-- Content -->
      <div class="popup-content">
        <!-- Add button -->
        <div class="add-section">
          <button
            class="add-preset-btn"
            on:click={() => showCreateForm = !showCreateForm}
          >
            + Crear Preset
          </button>
        </div>

        <!-- Create form -->
        {#if showCreateForm}
          <div class="create-form">
            {#if activeTab === 'resources'}
              <h3>{editingPreset ? 'Editar Recurso' : 'Crear Recurso'}</h3>
              <div class="form-group">
                <label>Nombre:</label>
                <input bind:value={newResourceForm.name} placeholder="Nombre del recurso" />
              </div>
              <div class="form-group">
                <label>Valor:</label>
                <input type="number" bind:value={newResourceForm.value} />
              </div>
              <div class="form-group">
                <label>Descripción:</label>
                <textarea bind:value={newResourceForm.description} placeholder="Descripción opcional"></textarea>
              </div>
              <div class="form-group">
                <label>Imagen:</label>
                <div class="image-selector">
                  <button
                    type="button"
                    class="image-picker-btn"
                    on:click={() => openImagePicker('resource')}
                  >
                    {#if newResourceForm.img}
                      <img src={newResourceForm.img} alt="Preview" class="image-preview" />
                    {:else}
                      Seleccionar Imagen
                    {/if}
                  </button>
                  {#if newResourceForm.img}
                    <button
                      type="button"
                      class="clear-image-btn"
                      on:click={() => { newResourceForm.img = ''; newResourceForm = { ...newResourceForm }; }}
                    >
                      ×
                    </button>
                  {/if}
                </div>
              </div>
              <div class="form-buttons">
                <button class="create-btn" on:click={createResourcePreset}>
                  {editingPreset ? 'Guardar' : 'Crear'}
                </button>
                <button class="cancel-btn" on:click={() => editingPreset ? cancelEdit() : (showCreateForm = false)}>Cancelar</button>
              </div>
            {:else if activeTab === 'reputations'}
              <h3>{editingPreset ? 'Editar Reputación' : 'Crear Reputación'}</h3>
              <div class="form-group">
                <label>Nombre:</label>
                <input bind:value={newReputationForm.name} placeholder="Nombre de la reputación" />
              </div>
              <div class="form-group">
                <label>Valor:</label>
                <input type="number" bind:value={newReputationForm.value} />
              </div>
              <div class="form-group">
                <label>Descripción:</label>
                <textarea bind:value={newReputationForm.description} placeholder="Descripción opcional"></textarea>
              </div>
              <div class="form-group">
                <label>Imagen:</label>
                <div class="image-selector">
                  <button
                    type="button"
                    class="image-picker-btn"
                    on:click={() => openImagePicker('reputation')}
                  >
                    {#if newReputationForm.img}
                      <img src={newReputationForm.img} alt="Preview" class="image-preview" />
                    {:else}
                      Seleccionar Imagen
                    {/if}
                  </button>
                  {#if newReputationForm.img}
                    <button
                      type="button"
                      class="clear-image-btn"
                      on:click={() => { newReputationForm.img = ''; newReputationForm = { ...newReputationForm }; }}
                    >
                      ×
                    </button>
                  {/if}
                </div>
              </div>
              <div class="form-buttons">
                <button class="create-btn" on:click={createReputationPreset}>
                  {editingPreset ? 'Guardar' : 'Crear'}
                </button>
                <button class="cancel-btn" on:click={() => editingPreset ? cancelEdit() : (showCreateForm = false)}>Cancelar</button>
              </div>
            {:else if activeTab === 'temporaryModifiers'}
              <h3>{editingPreset ? 'Editar Modificador Temporal' : 'Crear Modificador Temporal'}</h3>
              <div class="form-group">
                <label>Nombre:</label>
                <input bind:value={newTemporaryModifierForm.name} placeholder="Nombre del modificador" />
              </div>
              <div class="form-group">
                <label>Tipo:</label>
                <select bind:value={newTemporaryModifierForm.type}>
                  <option value="buff">Buff</option>
                  <option value="debuff">Debuff</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
              <div class="form-group">
                <label>Duración:</label>
                <input bind:value={newTemporaryModifierForm.duration} placeholder="ej: 1 turno, 10 minutos" />
              </div>
              <div class="form-group">
                <label>Descripción:</label>
                <textarea bind:value={newTemporaryModifierForm.description} placeholder="Descripción opcional"></textarea>
              </div>
              <div class="form-group">
                <label>Efectos en Stats:</label>
                <div class="stat-effects">
                  {#each stats as stat}
                    <div class="stat-effect-item">
                      <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} />
                      <span>{stat.name}</span>
                      <input
                        type="number"
                        value={newTemporaryModifierForm.statEffects[stat.key] || 0}
                        on:change={(e) => addStatEffect(stat.key, parseInt(e.target.value) || 0)}
                      />
                    </div>
                  {/each}
                </div>
              </div>
              <div class="form-buttons">
                <button class="create-btn" on:click={createTemporaryModifierPreset}>
                  {editingPreset ? 'Guardar' : 'Crear'}
                </button>
                <button class="cancel-btn" on:click={() => editingPreset ? cancelEdit() : (showCreateForm = false)}>Cancelar</button>
              </div>
            {:else if activeTab === 'situationalModifiers'}
              <h3>{editingPreset ? 'Editar Modificador Situacional' : 'Crear Modificador Situacional'}</h3>
              <div class="form-group">
                <label>Nombre:</label>
                <input bind:value={newSituationalModifierForm.name} placeholder="Nombre del modificador" />
              </div>
              <div class="form-group">
                <label>Modificador:</label>
                <input type="number" bind:value={newSituationalModifierForm.modifier} />
              </div>
              <div class="form-group">
                <label>Situación:</label>
                <input bind:value={newSituationalModifierForm.situation} placeholder="ej: En combate, Durante la noche" />
              </div>
              <div class="form-group">
                <label>Descripción:</label>
                <textarea bind:value={newSituationalModifierForm.description} placeholder="Descripción opcional"></textarea>
              </div>
              <div class="form-group">
                <label>Imagen:</label>
                <div class="image-selector">
                  <button
                    type="button"
                    class="image-picker-btn"
                    on:click={() => openImagePicker('situational')}
                  >
                    {#if newSituationalModifierForm.img}
                      <img src={newSituationalModifierForm.img} alt="Preview" class="image-preview" />
                    {:else}
                      Seleccionar Imagen
                    {/if}
                  </button>
                  {#if newSituationalModifierForm.img}
                    <button
                      type="button"
                      class="clear-image-btn"
                      on:click={() => { newSituationalModifierForm.img = ''; newSituationalModifierForm = { ...newSituationalModifierForm }; }}
                    >
                      ×
                    </button>
                  {/if}
                </div>
              </div>
              <div class="form-buttons">
                <button class="create-btn" on:click={createSituationalModifierPreset}>
                  {editingPreset ? 'Guardar' : 'Crear'}
                </button>
                <button class="cancel-btn" on:click={() => editingPreset ? cancelEdit() : (showCreateForm = false)}>Cancelar</button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Presets list -->
        <div class="presets-list">
          {#if activeTab === 'resources'}
            {#each presets.resources as preset}
              <div class="preset-item" on:dblclick={() => editPreset(preset)}>
                <div class="preset-info">
                  <h4>{preset.name}</h4>
                  <p>Valor: {preset.data.value}</p>
                  {#if preset.description}
                    <p class="description">{preset.description}</p>
                  {/if}
                </div>
                <div class="preset-actions">
                  <button class="use-btn" on:click={() => usePreset(preset)}>Usar</button>
                  <button class="delete-btn" on:click={() => deletePreset(preset)}>×</button>
                </div>
              </div>
            {/each}
          {:else if activeTab === 'reputations'}
            {#each presets.reputations as preset}
              <div class="preset-item" on:dblclick={() => editPreset(preset)}>
                <div class="preset-info">
                  <h4>{preset.name}</h4>
                  <p>Valor: {preset.data.value}</p>
                  {#if preset.description}
                    <p class="description">{preset.description}</p>
                  {/if}
                </div>
                <div class="preset-actions">
                  <button class="use-btn" on:click={() => usePreset(preset)}>Usar</button>
                  <button class="delete-btn" on:click={() => deletePreset(preset)}>×</button>
                </div>
              </div>
            {/each}
          {:else if activeTab === 'temporaryModifiers'}
            {#each presets.temporaryModifiers as preset}
              <div class="preset-item" on:dblclick={() => editPreset(preset)}>
                <div class="preset-info">
                  <h4>{preset.name}</h4>
                  <p>Tipo: {preset.data.type} | Duración: {preset.data.duration}</p>
                  {#if preset.description}
                    <p class="description">{preset.description}</p>
                  {/if}
                  <div class="stat-effects-preview">
                    {#each Object.entries(preset.data.statEffects) as [statKey, value]}
                      {@const stat = stats.find(s => s.key === statKey)}
                      {#if stat && value !== 0}
                        <span class="stat-effect-preview">
                          <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} />
                          {stat.name}: {value > 0 ? '+' : ''}{value}
                        </span>
                      {/if}
                    {/each}
                  </div>
                </div>
                <div class="preset-actions">
                  <button class="use-btn" on:click={() => usePreset(preset)}>Usar</button>
                  <button class="delete-btn" on:click={() => deletePreset(preset)}>×</button>
                </div>
              </div>
            {/each}
          {:else if activeTab === 'situationalModifiers'}
            {#each presets.situationalModifiers as preset}
              <div class="preset-item" on:dblclick={() => editPreset(preset)}>
                <div class="preset-info">
                  <h4>{preset.name}</h4>
                  <p>Modificador: {preset.data.modifier > 0 ? '+' : ''}{preset.data.modifier}</p>
                  <p>Situación: {preset.data.situation}</p>
                  {#if preset.description}
                    <p class="description">{preset.description}</p>
                  {/if}
                </div>
                <div class="preset-actions">
                  <button class="use-btn" on:click={() => usePreset(preset)}>Usar</button>
                  <button class="delete-btn" on:click={() => deletePreset(preset)}>×</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .presets-popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .presets-popup {
    position: absolute;
    background: #2a2a2a;
    border: 2px solid #d4af37;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
    min-width: 600px;
    max-width: 800px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .popup-header {
    background: #1a1a1a;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #d4af37;
    cursor: move;
  }

  .popup-header h2 {
    color: #d4af37;
    margin: 0;
    font-size: 1.2rem;
  }

  .close-button {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-size: 1.2rem;
  }

  .tabs {
    display: flex;
    background: #1a1a1a;
    border-bottom: 1px solid #d4af37;
  }

  .tab {
    flex: 1;
    padding: 0.75rem;
    background: transparent;
    border: none;
    color: #ccc;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab:hover {
    background: #333;
    color: #d4af37;
  }

  .tab.active {
    color: #d4af37;
    border-bottom-color: #d4af37;
    background: #333;
  }

  .popup-content {
    flex: 1;
    padding: 1rem;
    overflow-y: auto;
  }

  .add-section {
    margin-bottom: 1rem;
  }

  .add-preset-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }

  .add-preset-btn:hover {
    background: #218838;
  }

  .create-form {
    background: #1a1a1a;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    border: 1px solid #444;
  }

  .create-form h3 {
    color: #d4af37;
    margin-top: 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    color: #ccc;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #333;
    color: #fff;
  }

  .form-group textarea {
    resize: vertical;
    min-height: 60px;
  }

  .stat-effects {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
  }

  .stat-effect-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #333;
    border-radius: 4px;
  }

  .stat-effect-item img {
    width: 20px;
    height: 20px;
  }

  .stat-effect-item input {
    width: 60px;
    margin: 0;
  }

  .form-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .create-btn {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .create-btn:hover {
    background: #0056b3;
  }

  .cancel-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: #545b62;
  }

  .presets-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .preset-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #1a1a1a;
    border: 1px solid #444;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .preset-item:hover {
    background: #2a2a2a;
    border-color: #555;
  }

  .preset-item:hover .preset-info h4 {
    color: #f0d050;
  }

  .preset-info h4 {
    margin: 0 0 0.5rem 0;
    color: #d4af37;
  }

  .preset-info p {
    margin: 0.25rem 0;
    color: #ccc;
    font-size: 0.9rem;
  }

  .preset-info .description {
    color: #999;
    font-style: italic;
  }

  .stat-effects-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .stat-effect-preview {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #333;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .stat-effect-preview img {
    width: 16px;
    height: 16px;
  }

  .preset-actions {
    display: flex;
    gap: 0.5rem;
  }

  .use-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .use-btn:hover {
    background: #218838;
  }

  .delete-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .delete-btn:hover {
    background: #c82333;
  }

  .image-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .image-picker-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 120px;
    min-height: 60px;
    padding: 0.5rem;
    border: 2px dashed #666;
    border-radius: 6px;
    background: #333;
    color: #ccc;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .image-picker-btn:hover {
    border-color: #d4af37;
    background: #444;
    color: #d4af37;
  }

  .image-preview {
    max-width: 100px;
    max-height: 50px;
    object-fit: cover;
    border-radius: 4px;
  }

  .clear-image-btn {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-image-btn:hover {
    background: #c82333;
  }
</style>
