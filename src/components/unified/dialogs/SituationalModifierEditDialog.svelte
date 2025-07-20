<script context="module" lang="ts">
  // FilePicker is provided by Foundry at runtime
  declare const FilePicker: any;
</script>

<script lang="ts">
  import { getStats } from "@/guard/stats";
  import { createEventDispatcher, onDestroy, onMount } from "svelte";

  export let situationalModifier: any;
  export let visible: boolean = false;

  const dispatch = createEventDispatcher();

  let dialogElement: HTMLElement;
  let editName = '';
  let editDescription = '';
  let editImg = '';
  let editStatEffects: { [key: string]: number } = {};

  // Get available stats
  let stats = getStats();

  // Position state (copied exactly from ResourceEditDialog)
  let position = { x: 100, y: 100 };
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  function handleSave() {
    const updatedSituationalModifier = {
      ...situationalModifier,
      name: editName,
      description: editDescription,
      details: editDescription, // For backward compatibility
      img: editImg,
      statEffects: editStatEffects
    };

    console.log('SituationalModifierEditDialog handleSave - Original situational modifier:', situationalModifier);
    console.log('SituationalModifierEditDialog handleSave - Updated situational modifier:', updatedSituationalModifier);
    console.log('SituationalModifierEditDialog handleSave - Situational modifier ID:', situationalModifier?.id);
    console.log('SituationalModifierEditDialog handleSave - Situational modifier sourceId:', situationalModifier?.sourceId);
    dispatch('save', updatedSituationalModifier);
    handleClose();
  }

  function handleClose() {
    visible = false;
    dispatch('close');
  }

  // Drag functionality (copied exactly from ResourceEditDialog)
  function startDrag(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.close-button, .roll-button, select, input, textarea, button, .experience-chip, .image-preview-button')) {
      return; // Don't drag if clicking on interactive elements
    }

    isDragging = true;
    dragOffset.x = event.clientX - position.x;
    dragOffset.y = event.clientY - position.y;
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    event.preventDefault();
  }

  function handleDrag(event: MouseEvent) {
    if (isDragging) {
      position.x = event.clientX - dragOffset.x;
      position.y = event.clientY - dragOffset.y;
    }
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);

    // Save position to localStorage
    localStorage.setItem('crow-nest-situational-modifier-edit-dialog-position', JSON.stringify(position));
  }

  onMount(() => {
    // Load saved position
    const savedPosition = localStorage.getItem('crow-nest-situational-modifier-edit-dialog-position');
    if (savedPosition) {
      try {
        position = JSON.parse(savedPosition);
      } catch (e) {
        // Use default position if parsing fails
      }
    }
  });

  // Track if inputs have been filled to prevent overwriting user input
  let inputsFilled = false;

  // Fill inputs only once when dialog opens
  function fillInputs() {
    console.log('fillInputs called with situational modifier:', situationalModifier);
    if (situationalModifier && !inputsFilled) {
      editName = situationalModifier.name || '';
      editDescription = situationalModifier.description || situationalModifier.details || '';
      editImg = situationalModifier.img || '';
      editStatEffects = { ...situationalModifier.statEffects } || {};
      inputsFilled = true;
      console.log('Filled inputs:', { editName, editDescription, editImg, editStatEffects });
    }
  }

  // Reset and fill inputs when dialog becomes visible
  $: if (visible && situationalModifier) {
    if (!inputsFilled) {
      fillInputs();
    }
  }

  // Reset flag when dialog closes
  $: if (!visible) {
    inputsFilled = false;
  }

  // Handle image selection using Foundry's FilePicker
  function handleImageSelect() {
    if (typeof FilePicker !== "undefined") {
      new FilePicker({
        type: "image",
        current: editImg || "",
        callback: (path: string) => {
          editImg = path;
        },
      }).render(true);
    } else {
      console.warn("FilePicker not available");
    }
  }

  // Handle keyboard events for accessibility
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      handleSave();
    }
  }

  onDestroy(() => {
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  });
</script>

{#if visible}
  <div
    class="roll-dialog-standalone"
    bind:this={dialogElement}
    style="left: {position.x}px; top: {position.y}px;"
    on:mousedown={startDrag}
    on:keydown={handleKeydown}
    role="dialog"
    aria-labelledby="dialog-title"
    tabindex="-1"
  >
    <div class="dialog-header">
      <h2 id="dialog-title">
        {situationalModifier?.id ? 'Editar' : 'Crear'} Modificador Situacional
      </h2>
      <button class="close-button" on:click={handleClose} title="Cerrar">×</button>
    </div>

    <div class="dialog-content">
      <!-- Basic info section -->
      <fieldset class="modifier-container">
        <legend>Información Básica</legend>

        <!-- Name input -->
        <div class="form-group">
          <label for="modifier-name">Nombre:</label>
          <input
            id="modifier-name"
            type="text"
            bind:value={editName}
            placeholder="Nombre del modificador situacional"
          />
        </div>

        <!-- Description input -->
        <div class="form-group">
          <label for="modifier-description">Descripción:</label>
          <textarea
            id="modifier-description"
            bind:value={editDescription}
            placeholder="Descripción del modificador..."
            rows="3"
          ></textarea>
        </div>

        <!-- Image section -->
        <div class="form-group">
          <label>Imagen:</label>
          <div class="image-selector">
            {#if editImg}
              <img src={editImg} alt="Preview" class="image-preview" on:click={handleImageSelect} />
            {/if}
            <button class="image-select-button" on:click={handleImageSelect}>
              {editImg ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
            </button>
          </div>
        </div>
      </fieldset>

      <!-- Stat effects section -->
      <fieldset class="modifier-container">
        <legend>Efectos en Estadísticas</legend>
        <div class="stat-effects-grid">
          {#each stats as stat}
            <div class="stat-effect-item">
              <div class="stat-info">
                <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} class="stat-icon" />
                <label for="stat-{stat.key}">{stat.name}:</label>
              </div>
              <input
                id="stat-{stat.key}"
                type="number"
                bind:value={editStatEffects[stat.key]}
                placeholder="0"
                min="-10"
                max="10"
                step="1"
              />
            </div>
          {/each}
        </div>
      </fieldset>

      <!-- Action buttons -->
      <div class="roll-button-container">
        <button class="roll-button" on:click={handleSave}>
          💾 Guardar
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .roll-dialog-standalone {
    position: fixed;
    background: var(--color-bg, #2a2a2a);
    border: 2px solid var(--color-border-dark, #666);
    border-radius: 8px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    z-index: 100; /* High enough for popups but not over Foundry UI */
    user-select: none;
  }

  .dialog-header {
    background: var(--color-bg-header, #1a1a1a);
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border-dark, #666);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 6px 6px 0 0;
    cursor: move;
  }

  .dialog-header h2 {
    margin: 0;
    color: var(--color-text-primary, #fff);
    font-size: 1rem;
    font-weight: bold;
    flex: 1;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1rem;
    color: var(--color-text-primary, #fff);
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
    flex: 0 1 24px;
    line-height: 0;
    position: static;
  }

  .close-button:hover {
    background-color: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
  }

  .dialog-content {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modifier-container {
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.02);
    margin: 0;
  }

  .modifier-container legend {
    color: var(--color-text-primary, #fff);
    font-weight: bold;
    padding: 0 0.5rem;
    font-size: 0.9rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    color: var(--color-text-primary, #fff);
    font-weight: bold;
    font-size: 0.9rem;
  }

  .modifier-container input,
  .modifier-container select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    background: var(--color-bg-input, #3a3a3a);
    color: var(--color-text-primary, #fff);
  }

  .modifier-container textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    background: var(--color-bg-input, #3a3a3a);
    color: var(--color-text-primary, #fff);
    resize: vertical;
    font-family: inherit;
  }

  .modifier-container input::placeholder,
  .modifier-container textarea::placeholder {
    color: var(--color-text-muted, #999);
  }

  .stat-effects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
  }

  .stat-effect-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.02);
  }

  .stat-info {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
  }

  .stat-icon {
    width: 20px;
    height: 20px;
    object-fit: cover;
  }

  .stat-effect-item label {
    font-size: 0.8rem;
    color: var(--color-text-primary, #fff);
    margin: 0;
  }

  .stat-effect-item input {
    width: 60px;
    margin: 0;
    padding: 0.25rem;
    font-size: 0.9rem;
  }

  .image-selector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }

  .image-preview {
    max-width: 100px;
    max-height: 100px;
    border: 2px solid var(--color-border-dark, #666);
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 0.2s;
  }

  .image-preview:hover {
    border-color: var(--color-bg-primary, #007bff);
  }

  .image-select-button {
    background: var(--color-bg-secondary, #444);
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    padding: 0.5rem 1rem;
    color: var(--color-text-primary, #fff);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: background-color 0.2s;
  }

  .image-select-button:hover {
    background: var(--color-bg-primary, #007bff);
  }

  .roll-button-container {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .roll-button {
    background: var(--color-bg-primary, #007bff);
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    padding: 0.75rem 1.5rem;
    color: var(--color-text-primary, #fff);
    cursor: pointer;
    font-weight: bold;
    font-size: 1rem;
    transition: background-color 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .roll-button:hover {
    background: var(--color-bg-primary-hover, #0056b3);
  }

  .roll-button:active {
    transform: translateY(1px);
  }
</style>
