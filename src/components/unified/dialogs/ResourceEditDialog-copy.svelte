<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from "svelte";

  export let resource: any;
  export let visible: boolean = false;

  const dispatch = createEventDispatcher();

  let dialogElement: HTMLElement;
  let formData = {
    name: "",
    value: 0,
    details: ""
  };

  // Position and drag functionality (copied from roll-dialog)
  let position = { x: 200, y: 150 };
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // Initialize form data when resource changes
  $: if (resource && visible) {
    formData = {
      name: resource.name || resource.description || "",
      value: resource.value || resource.quantity || 0,
      details: resource.details || resource.description || ""
    };
  }

  function handleSave() {
    const updatedResource = {
      ...resource,
      ...formData
    };
    dispatch('save', updatedResource);
    handleClose();
  }

  function handleClose() {
    dispatch('close');
  }

  // Drag functionality (copied from roll-dialog)
  function startDrag(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.close-button, input, textarea, button')) {
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

  // Close on Escape key (like roll-dialog)
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);

    // Load saved position
    const savedPosition = localStorage.getItem('crow-nest-resource-edit-dialog-position');
    if (savedPosition) {
      try {
        position = JSON.parse(savedPosition);
      } catch (e) {
        // Use default position if parsing fails
      }
    }
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    stopDrag();

    // Save position
    localStorage.setItem('crow-nest-resource-edit-dialog-position', JSON.stringify(position));
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="resource-edit-dialog"
    bind:this={dialogElement}
    style="left: {position.x}px; top: {position.y}px;"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <header class="dialog-header" on:mousedown={startDrag} style="cursor: {isDragging ? 'grabbing' : 'grab'}">
      <h1>Editar Recurso</h1>
      <button class="close-button" on:click={handleClose} type="button">×</button>
    </header>

    <div class="dialog-content">
      <div class="form-group">
        <label for="resource-name">Nombre:</label>
        <input
          id="resource-name"
          type="text"
          bind:value={formData.name}
          placeholder="Nombre del recurso"
        />
      </div>

      <div class="form-group">
        <label for="resource-value">Valor:</label>
        <input
          id="resource-value"
          type="number"
          bind:value={formData.value}
          min="0"
        />
      </div>

      <div class="form-group">
        <label for="resource-details">Detalles:</label>
        <textarea
          id="resource-details"
          bind:value={formData.details}
          placeholder="Detalles del recurso"
          rows="3"
        ></textarea>
      </div>

      <div class="dialog-footer">
        <button class="cancel-button" on:click={handleClose} type="button">Cancelar</button>
        <button class="save-button" on:click={handleSave} type="button">Guardar</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .resource-edit-dialog {
    position: fixed;
    background: var(--color-bg, #2a2a2a);
    border: 2px solid var(--color-border-dark, #666);
    border-radius: 8px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    z-index: 100;
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

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: bold;
    color: var(--color-text-primary, #fff);
    font-size: 0.9rem;
  }

  .form-group input,
  .form-group textarea {
    padding: 0.5rem;
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    background: var(--color-bg-input, #3a3a3a);
    color: var(--color-text-primary, #fff);
    user-select: text;
  }

  .form-group input::placeholder,
  .form-group textarea::placeholder {
    color: var(--color-text-muted, #999);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }

  .dialog-footer {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--color-border-dark, #666);
  }

  .cancel-button,
  .save-button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button {
    background: var(--color-bg-secondary, #6c757d);
    color: white;
  }

  .cancel-button:hover {
    background: var(--color-bg-secondary-hover, #5a6268);
  }

  .save-button {
    background: var(--color-bg-primary, #007bff);
    color: white;
  }

  .save-button:hover {
    background: var(--color-bg-primary-hover, #0056b3);
    transform: translateY(-1px);
  }
</style>
