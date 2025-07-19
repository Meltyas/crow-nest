<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";

  export let reputation: any;
  export let visible: boolean = false;

  const dispatch = createEventDispatcher();

  let dialogElement: HTMLDivElement;
  let formData = {
    name: "",
    value: 0,
    details: ""
  };

  // Drag functionality
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  // Initialize form data when reputation changes
  $: if (reputation && visible) {
    formData = {
      name: reputation.name || reputation.description || "",
      value: reputation.value || 0,
      details: reputation.details || reputation.description || ""
    };
  }

  function handleSave() {
    const updatedReputation = {
      ...reputation,
      ...formData
    };
    dispatch('save', updatedReputation);
    handleClose();
  }

  function handleClose() {
    dispatch('close');
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.target === event.currentTarget || (event.target as HTMLElement).tagName === 'H1') {
      isDragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;

      const rect = dialogElement.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      event.preventDefault();
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (!isDragging) return;

    const deltaX = event.clientX - dragStartX;
    const deltaY = event.clientY - dragStartY;

    const newLeft = Math.max(0, Math.min(window.innerWidth - 400, initialLeft + deltaX));
    const newTop = Math.max(0, Math.min(window.innerHeight - 200, initialTop + deltaY));

    dialogElement.style.left = `${newLeft}px`;
    dialogElement.style.top = `${newTop}px`;
  }

  function handleMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  onMount(() => {
    if (dialogElement) {
      // Center the dialog initially
      const rect = dialogElement.getBoundingClientRect();
      const centerX = (window.innerWidth - rect.width) / 2;
      const centerY = (window.innerHeight - rect.height) / 2;

      dialogElement.style.left = `${centerX}px`;
      dialogElement.style.top = `${centerY}px`;
    }
  });
</script>

{#if visible}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div bind:this={dialogElement} class="reputation-edit-dialog" on:mousedown|stopPropagation>
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="dialog-header" on:mousedown={handleMouseDown} style="cursor: {isDragging ? 'grabbing' : 'grab'}">
      <h1>Editar Reputación</h1>
      <button class="close-button" on:click={handleClose}>×</button>
    </div>

    <div class="dialog-content">
      <div class="form-group">
        <label for="reputation-name">Nombre:</label>
        <input
          id="reputation-name"
          type="text"
          bind:value={formData.name}
          placeholder="Nombre de la reputación"
        />
      </div>

      <div class="form-group">
        <label for="reputation-value">Valor:</label>
        <input
          id="reputation-value"
          type="number"
          bind:value={formData.value}
          min="0"
        />
      </div>

      <div class="form-group">
        <label for="reputation-details">Detalles:</label>
        <textarea
          id="reputation-details"
          bind:value={formData.details}
          placeholder="Detalles de la reputación"
          rows="3"
        ></textarea>
      </div>

      <div class="dialog-footer">
        <button class="cancel-button" on:click={handleClose}>Cancelar</button>
        <button class="save-button" on:click={handleSave}>Guardar</button>
      </div>
    </div>
  </div>
{/if}
<style>
  .reputation-edit-dialog {
    position: fixed;
    background: var(--color-bg, #2a2a2a);
    border: 2px solid var(--color-border-dark, #666);
    border-radius: 8px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    z-index: 2000;
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
