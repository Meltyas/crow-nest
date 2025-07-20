<script context="module" lang="ts">
  // FilePicker is provided by Foundry at runtime
  declare const FilePicker: any;
</script>

<script lang="ts">
  import { getStats } from "@/guard/stats";
  import { createEventDispatcher, onDestroy, onMount } from "svelte";

  export let patrolEffect: any;
  export let visible: boolean = false;

  const dispatch = createEventDispatcher();

  let dialogElement: HTMLElement;
  let editName = '';
  let editDescription = '';
  let editImg = '';
  let editStatEffects: { [key: string]: number } = {};

  // Get available stats
  let stats = getStats();

  // Position state
  let position = { x: 100, y: 100 };
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // Track if inputs have been filled to prevent overwriting user input
  let inputsFilled = false;

  // Fill inputs only once when dialog opens
  function fillInputs() {
    console.log('fillInputs called with patrol effect:', patrolEffect);
    if (patrolEffect && !inputsFilled) {
      editName = patrolEffect.name || '';
      editDescription = patrolEffect.description || patrolEffect.details || '';
      editImg = patrolEffect.img || '';
      editStatEffects = { ...patrolEffect.statEffects } || {};
      inputsFilled = true;
      console.log('Filled inputs:', { editName, editDescription, editImg, editStatEffects });
    }
  }

  // Reset and fill inputs when dialog becomes visible
  $: if (visible && patrolEffect) {
    if (!inputsFilled) {
      fillInputs();
    }
  }

  // Reset flag when dialog closes
  $: if (!visible) {
    inputsFilled = false;
  }

  function handleSave() {
    const updatedPatrolEffect = {
      ...patrolEffect,
      name: editName,
      description: editDescription,
      details: editDescription, // For backward compatibility
      img: editImg,
      statEffects: editStatEffects
    };

    console.log('PatrolEffectEditDialog handleSave - Original patrol effect:', patrolEffect);
    console.log('PatrolEffectEditDialog handleSave - Updated patrol effect:', updatedPatrolEffect);
    console.log('PatrolEffectEditDialog handleSave - Patrol effect ID:', patrolEffect?.id);
    console.log('PatrolEffectEditDialog handleSave - Patrol effect sourceId:', patrolEffect?.sourceId);
    dispatch('save', updatedPatrolEffect);
    handleClose();
  }

  function handleClose() {
    visible = false;
    dispatch('close');
  }

  // Drag functionality
  function startDrag(event: MouseEvent) {
    // Only start drag if clicking on header, not on interactive elements
    if ((event.target as HTMLElement).closest('.close-button, .roll-button, select, input, textarea, button, .experience-chip, .image-preview-button')) {
      return; // Don't drag if clicking on interactive elements
    }

    isDragging = true;
    dragOffset.x = event.clientX - position.x;
    dragOffset.y = event.clientY - position.y;
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
  }

  function handleDrag(event: MouseEvent) {
    if (isDragging) {
      position.x = event.clientX - dragOffset.x;
      position.y = event.clientY - dragOffset.y;
    }
  }

  function stopDrag() {
    if (isDragging) {
      isDragging = false;
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);

      // Save position to localStorage
      localStorage.setItem('crow-nest-patrol-effect-edit-dialog-position', JSON.stringify(position));
    }
  }

  onMount(() => {
    // Load saved position
    const savedPosition = localStorage.getItem('crow-nest-patrol-effect-edit-dialog-position');
    if (savedPosition) {
      try {
        position = JSON.parse(savedPosition);
      } catch (e) {
        // Use default position if parsing fails
      }
    }
  });

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

  // Handle stat effect changes
  function updateStatEffect(statKey: string, value: number) {
    editStatEffects[statKey] = value;
    editStatEffects = { ...editStatEffects };
  }

  onDestroy(() => {
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  });
</script>

{#if visible}
  <div
    class="roll-dialog-standalone"
    style="left: {position.x}px; top: {position.y}px;"
    bind:this={dialogElement}
    on:mousedown={startDrag}
    on:keydown={(e) => e.key === 'Escape' && handleClose()}
    role="dialog"
    aria-label="Editar Efecto de Patrulla"
    tabindex="-1"
  >
    <div class="dialog-header">
      <h1>Editar Efecto de Patrulla</h1>
      <button class="close-button" on:click={handleClose}>×</button>
    </div>

    <div class="dialog-content">
      <!-- Name input -->
      <fieldset class="modifier-container">
        <legend>Nombre</legend>
        <input
          type="text"
          bind:value={editName}
          placeholder="Nombre del efecto"
        />
      </fieldset>

      <!-- Description input -->
      <fieldset class="modifier-container">
        <legend>Descripción</legend>
        <textarea
          bind:value={editDescription}
          placeholder="Descripción del efecto"
          rows="3"
        ></textarea>
      </fieldset>

      <!-- Stat Effects -->
      <fieldset class="modifier-container">
        <legend>Efectos en Stats</legend>
        <div class="stat-effects-grid">
          {#each stats as stat}
            <div class="stat-effect-item">
              <img src={stat.img || 'icons/svg/shield.svg'} alt={stat.name} />
              <span class="stat-name">{stat.name}</span>
              <input
                type="number"
                value={editStatEffects[stat.key] || 0}
                on:input={(e) => updateStatEffect(stat.key, parseInt(e.currentTarget.value) || 0)}
                class="stat-value-input"
              />
            </div>
          {/each}
        </div>
      </fieldset>

      <!-- Image selector -->
      <fieldset class="modifier-container">
        <legend>Imagen</legend>
        <div class="image-selector">
          {#if editImg}
            <button
              type="button"
              class="image-preview-button"
              on:click={handleImageSelect}
              aria-label="Cambiar imagen"
            >
              <img
                src={editImg}
                alt="Preview"
                class="image-preview"
              />
            </button>
          {/if}
          <button
            type="button"
            class="image-select-button"
            on:click={handleImageSelect}
          >
            📁 Seleccionar Imagen
          </button>
          <input
            type="text"
            bind:value={editImg}
            placeholder="Ruta de la imagen"
            class="image-path-input"
          />
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
  }

  .dialog-header h1 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-text-primary, #fff);
    font-weight: bold;
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
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
  }

  .stat-effect-item img {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  .stat-name {
    flex: 1;
    color: var(--color-text-primary, #fff);
    font-size: 0.9rem;
  }

  .stat-value-input {
    width: 60px !important;
    padding: 0.25rem !important;
    font-size: 0.9rem;
  }

  .image-selector {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }

  .image-preview {
    max-width: 200px;
    border: 2px solid var(--color-border-dark, #666);
    border-radius: 4px;
    transition: border-color 0.2s;
  }

  .image-preview-button {
    display: contents;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 4px;
    transition: opacity 0.2s;
  }

  .image-preview-button:hover {
    opacity: 0.8;
  }

  .image-preview-button .image-preview:hover {
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
    font-size: 0.9rem;
  }

  .image-select-button:hover {
    background: var(--color-bg-secondary-hover, #555);
  }

  .image-path-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    background: var(--color-bg-input, #3a3a3a);
    color: var(--color-text-primary, #fff);
    font-size: 0.8rem;
    margin-top: 0.25rem;
  }

  .roll-button-container {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
  }

  .roll-button {
    background: var(--color-bg-primary, #007bff);
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1.5rem;
    color: white;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s;
    font-size: 1rem;
  }

  .roll-button:hover {
    background: var(--color-bg-primary-hover, #0056b3);
  }
</style>