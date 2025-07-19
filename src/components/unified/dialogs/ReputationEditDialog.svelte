<script context="module" lang="ts">
  // FilePicker is provided by Foundry at runtime
  declare const FilePicker: any;
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";

  export let reputation: any;
  export let visible: boolean = false;

  const dispatch = createEventDispatcher();

  let dialogElement: HTMLElement;
  let editName = '';
  let editValue = 0;
  let editDescription = '';
  let editImg = '';

  // Position state (copied exactly from ResourceEditDialog)
  let position = { x: 100, y: 100 };
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  function handleSave() {
    const updatedReputation = {
      ...reputation,
      name: editName,
      value: editValue,
      description: editDescription,
      details: editDescription, // ItemCard expects 'details'
      img: editImg
    };

    console.log('ReputationEditDialog handleSave - Original reputation:', reputation);
    console.log('ReputationEditDialog handleSave - Updated reputation:', updatedReputation);
    console.log('ReputationEditDialog handleSave - Reputation ID:', reputation?.id);
    console.log('ReputationEditDialog handleSave - Reputation sourceId:', reputation?.sourceId);
    dispatch('save', updatedReputation);
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

      // Keep within viewport bounds
      const rect = dialogElement?.getBoundingClientRect();
      if (rect) {
        position.x = Math.max(0, Math.min(window.innerWidth - rect.width, position.x));
        position.y = Math.max(0, Math.min(window.innerHeight - rect.height, position.y));
      }
    }
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  // Close on Escape key (copied from ResourceEditDialog)
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);

    // Load saved position
    const savedPosition = localStorage.getItem('crow-nest-reputation-edit-dialog-position');
    if (savedPosition) {
      try {
        position = JSON.parse(savedPosition);
      } catch (e) {
        // Use default position if parsing fails
      }
    }
  });

  // Fill inputs when reputation changes (simple function, not reactive)
  function fillInputs() {
    console.log('fillInputs called with reputation:', reputation);
    if (reputation) {
      editName = reputation.name || '';
      editValue = reputation.value || 0;
      editDescription = reputation.description || reputation.details || '';
      editImg = reputation.img || '';
      console.log('Filled inputs:', { editName, editValue, editDescription, editImg });
    }
  }

  // Call fillInputs when visible becomes true
  $: if (visible && reputation) {
    fillInputs();
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
      console.warn("FilePicker no está disponible");
    }
  }

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    stopDrag();

    // Save position
    localStorage.setItem('crow-nest-reputation-edit-dialog-position', JSON.stringify(position));
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="roll-dialog-standalone"
    bind:this={dialogElement}
    style="left: {position.x}px; top: {position.y}px; cursor: {isDragging ? 'grabbing' : 'grab'}"
    on:mousedown={startDrag}
  >
    <header class="dialog-header">
      <h1>Editar Reputación</h1>
      <button class="close-button" on:click={handleClose} type="button">×</button>
    </header>

    <div class="dialog-content">
      <!-- Reputation Name -->
      <fieldset class="modifier-container">
        <legend>Nombre de la Reputación</legend>

        <input
          type="text"
          bind:value={editName}
          placeholder="Nombre de la reputación..."
        />
      </fieldset>

      <!-- Reputation Value -->
      <fieldset class="modifier-container">
        <legend>Valor/Nivel</legend>

        <input
          type="number"
          bind:value={editValue}
          placeholder="0"
          min="0"
        />
      </fieldset>

      <!-- Reputation Description -->
      <fieldset class="modifier-container">
        <legend>Descripción</legend>

        <textarea
          bind:value={editDescription}
          placeholder="Descripción de la reputación..."
          rows="3"
        ></textarea>
      </fieldset>

      <!-- Reputation Image -->
      <fieldset class="modifier-container">
        <legend>Imagen</legend>

        <div class="image-selector">
          {#if editImg}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <img
              class="image-preview"
              src={editImg}
              alt="Vista previa de la reputación"
              on:click={handleImageSelect}
            />
          {/if}

          <button
            type="button"
            class="image-select-button"
            on:click={handleImageSelect}
          >
            <i class="fas fa-image"></i>
            {editImg ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
          </button>

          {#if editImg}
            <input
              type="text"
              bind:value={editImg}
              placeholder="Ruta de la imagen..."
              class="image-path-input"
            />
          {/if}
        </div>
      </fieldset>

      <!-- Save Button -->
      <div class="roll-button-container">
        <button class="roll-button" on:click={handleSave} type="button">
          <i class="fas fa-save"></i>
          Guardar Reputación
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

  .modifier-container input {
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
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }

  .roll-button:hover {
    background: var(--color-bg-primary-hover, #0056b3);
    transform: translateY(-1px);
  }

  .roll-button:active {
    transform: translateY(0);
  }
</style>
