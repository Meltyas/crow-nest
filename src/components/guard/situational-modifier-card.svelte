<script context="module" lang="ts">
  // ChatMessage is provided by Foundry at runtime
  declare const ChatMessage: any;
  declare const FilePicker: any;
</script>

<script lang="ts">
  import Tooltip from '@/components/tooltip.svelte';
  import { getStats } from '@/guard/stats';
  import { createEventDispatcher } from 'svelte';

  export let situationalModifier: any; // SituationalModifier object
  export let index: number;
  export let expandedDetails: Record<string, boolean> = {};
  export let draggedIndex: number | null = null;
  export let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};
  export let inPresetManager = false; // Show activate/deactivate preset buttons when true
  export let simpleView = false; // Show only image with tooltip for groups view

  const dispatch = createEventDispatcher();
  const stats = getStats();

  // Reactive variables for drag and drop
  $: isDragged = draggedIndex === index;
  $: dropZone = dropZoneVisible[index];
  $: isExpanded = (expandedDetails && expandedDetails[situationalModifier.key || situationalModifier.id]) || false;

  function handleImageClick() {
    if (simpleView) {
      // En groups (simple view): click muestra en chat, doble click edita
      return; // Los eventos se manejan directamente en el template
    }

    // Usar el selector de imágenes nativo de Foundry
    if (typeof FilePicker !== "undefined") {
      new FilePicker({
        type: "image",
        current: situationalModifier.img || 'icons/svg/upgrade.svg',
        callback: (path: string) => {
          // Actualizar la imagen del situational modifier
          situationalModifier.img = path;

          // Disparar evento para compatibilidad
          dispatch('imageClick', situationalModifier);
        },
      }).render(true);
    } else {
      // Fallback si FilePicker no está disponible
      console.warn("FilePicker no está disponible");
      dispatch('imageClick', situationalModifier);
    }
  }

  function handleImageClickForFullView(event: MouseEvent) {
    event.stopPropagation();
    handleImageClick();
  }

  function handleImageClickWithStopPropagation(event: MouseEvent) {
    event.stopPropagation(); // Evitar que el evento llegue al grupo
    console.log('SituationalModifierCard - handleImageClickWithStopPropagation called');
    handleShowInChat(); // En simpleView, click muestra en chat
  }

  function handleImageDoubleClickSimple(event: MouseEvent) {
    event.stopPropagation(); // Evitar que el evento llegue al grupo
    console.log('SituationalModifierCard - handleImageDoubleClickSimple called');
    handleEdit(); // En simpleView, doble click edita
  }

  function handleImageRightClickSimple(event: MouseEvent) {
    event.preventDefault(); // Prevenir menú contextual del navegador
    event.stopPropagation(); // Evitar que el evento llegue al grupo
    console.log('SituationalModifierCard - handleImageRightClickSimple called, shiftKey:', event.shiftKey);

    if (event.shiftKey) {
      // Shift + right click: eliminar
      handleRemove();
    } else {
      // Right click simple: editar
      handleEdit();
    }
  }

  function handleImageRightClick(event: MouseEvent) {
    event.preventDefault(); // Prevenir menú contextual del navegador
    event.stopPropagation(); // Evitar que el evento llegue al grupo

    if (event.shiftKey) {
      // Shift + right click: eliminar
      if (inPresetManager) {
        handleRemovePreset();
      } else {
        handleRemove();
      }
    } else {
      // Right click simple: editar
      handleEdit();
    }
  }

  function handleRemove() {
    console.log('SituationalModifierCard - handleRemove called, dispatching remove event with index:', index);
    dispatch('remove', index);
  }

  function handleEdit() {
    console.log('SituationalModifierCard - handleEdit called, dispatching edit event with:', situationalModifier);
    dispatch('edit', situationalModifier);
  }

  function handleShowInChat() {
    showSituationalModifierInChat();
  }

  function handleCreatePreset() {
    dispatch('createPreset', situationalModifier);
  }

  function handleActivatePreset() {
    dispatch('activatePreset', { id: situationalModifier.id, active: !situationalModifier.active });
  }

  function handleRemovePreset() {
    dispatch('removePreset', situationalModifier.id);
  }

  function handleUse() {
    dispatch('use', situationalModifier);
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent) {
    console.log('SituationalModifierCard - handleDragStart, index:', index);
    dispatch('dragStart', index);
  }

  function handleDragEnd() {
    console.log('SituationalModifierCard - handleDragEnd');
    dispatch('dragEnd');
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    console.log('SituationalModifierCard - handleDragEnter, index:', index);
    dispatch('dragEnter', index);
  }

  function handleDragLeave(event: DragEvent) {
    console.log('SituationalModifierCard - handleDragLeave, index:', index);
    dispatch('dragLeave', index);
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent, position: 'left' | 'right') {
    event.preventDefault();
    console.log('SituationalModifierCard - handleDrop, position:', position, 'index:', index);
    dispatch('drop', { draggedIndex, targetIndex: index, position });
  }

  // Action handlers with stopPropagation
  function handleEditWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleEdit();
  }

  function handleShowInChatWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleShowInChat();
  }

  function handleUseWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleUse();
  }

  function handleActivateWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleActivatePreset();
  }

  function handleRemoveWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    if (inPresetManager) {
      handleRemovePreset();
    } else {
      handleRemove();
    }
  }

  function handleDebugData(event: MouseEvent) {
    event.stopPropagation();
    console.log('SituationalModifierCard Debug Data:', {
      situationalModifier,
      index,
      isExpanded,
      isDragged,
      dropZone,
      inPresetManager,
      simpleView
    });
  }

  function toggleDetails(event: MouseEvent) {
    event.stopPropagation();
    const key = situationalModifier.key || situationalModifier.id;
    if (!expandedDetails) {
      expandedDetails = {};
    }
    expandedDetails[key] = !expandedDetails[key];
    expandedDetails = { ...expandedDetails };
  }

  async function showSituationalModifierInChat() {
    const name = situationalModifier.name || 'Modificador Situacional';
    const description = situationalModifier.description
      ? `<div style="margin-bottom: 0.5rem; font-style: italic; color: #666;">${situationalModifier.description}</div>`
      : '';

    const statsDisplay = Object.keys(situationalModifier.statEffects || {}).length > 0
      ? `<div style="margin-top: 0.5rem;">
          <div style="font-weight: bold; color: #9b59b6; margin-bottom: 0.3rem; font-size: 0.9em;">Efectos en Stats:</div>
          ${Object.entries(situationalModifier.statEffects || {})
            .filter(([_, value]) => Number(value) !== 0)
            .map(([stat, value]) => {
              const statData = stats?.find(s => s.key === stat);
              const color = Number(value) >= 0 ? '#28a745' : '#dc3545';
              return `<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                <img src="${statData?.img || 'icons/svg/shield.svg'}" style="width: 16px; height: 16px; border-radius: 2px;" />
                <span style="color: #ffffff; font-size: 0.85em;">${statData?.name || stat}:</span>
                <span style="color: ${color}; font-weight: bold; font-size: 0.85em;">${Number(value) >= 0 ? '+' : ''}${Number(value)}</span>
              </div>`;
            }).join('')}
        </div>`
      : '';

    const content = `
      <div style="
        background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%);
        border: 2px solid #8e44ad;
        border-radius: 8px;
        padding: 1rem;
        color: #ffffff;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        max-width: 400px;
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.75rem;
        ">
          <img src="${situationalModifier.img || 'icons/svg/upgrade.svg'}" alt="${name}" style="
            width: 60px;
            height: 60px;
            object-fit: cover;
            border: 2px solid #ffffff;
            border-radius: 8px;
            background: #000000;
          " />
          <div>
            <h3 style="
              margin: 0 0 0.25rem 0;
              color: #ffffff;
              font-size: 1.1em;
              font-weight: bold;
            ">${name}</h3>
            <div style="
              color: rgba(255, 255, 255, 0.9);
              font-size: 0.9em;
              font-weight: bold;
            ">Modificador Situacional</div>
          </div>
        </div>
        ${description}
        ${statsDisplay}
      </div>
    `;

    try {
      ChatMessage.create({
        content: content,
        speaker: { alias: "Modificadores Situacionales" }
      });
    } catch (error) {
      console.error('Error creating chat message:', error);
    }
  }

  // Tooltip content for simple view
  $: tooltipContent = (() => {
    const name = situationalModifier.name || 'Modificador Situacional';
    const description = situationalModifier.description
      ? `<div style="margin-bottom: 0.5rem; font-style: italic;">${situationalModifier.description}</div>`
      : '';

    const statsDisplay = Object.keys(situationalModifier.statEffects || {}).length > 0
      ? `<div style="margin-top: 0.5rem;">
          <div style="font-weight: bold; color: #9b59b6; margin-bottom: 0.3rem; font-size: 0.9em;">Efectos en Stats:</div>
          ${Object.entries(situationalModifier.statEffects || {})
            .filter(([_, value]) => Number(value) !== 0)
            .map(([stat, value]) => {
              const statData = stats?.find(s => s.key === stat);
              const color = Number(value) >= 0 ? '#28a745' : '#dc3545';
              return `<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.2rem;">
                <img src="${statData?.img || 'icons/svg/shield.svg'}" style="width: 16px; height: 16px; border-radius: 2px;" />
                <span style="color: #ffffff; font-size: 0.85em;">${statData?.name || stat}:</span>
                <span style="color: ${color}; font-weight: bold; font-size: 0.85em;">${Number(value) >= 0 ? '+' : ''}${Number(value)}</span>
              </div>`;
            }).join('')}
        </div>`
      : '';

    const controlsInfo = `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #666; font-size: 0.8em; color: #ccc;">
      <div>Click: Mostrar en chat</div>
      <div>Right-click: Editar</div>
      <div>Shift+Right-click: Eliminar</div>
    </div>`;

    return `<div style="max-width: 300px;">
      <div style="font-weight: bold; color: #9b59b6; margin-bottom: 0.3rem;">${name}</div>
      ${description}
      ${statsDisplay}
      ${controlsInfo}
    </div>`;
  })();
</script>

<div class="modifier-card-container">
  {#if simpleView}
    <!-- Simple view for groups - same structure as PatrolCard -->
    <div class="patrol-simple-view">
      <Tooltip content={tooltipContent}>
        <button
          class="patrol-simple-image-button"
          on:click={handleImageClickWithStopPropagation}
          on:dblclick={handleImageDoubleClickSimple}
          on:contextmenu={handleImageRightClickSimple}
        >
          <img
            class="patrol-simple-image"
            src={situationalModifier.img || 'icons/svg/upgrade.svg'}
            alt={situationalModifier.name}
          />
        </button>
      </Tooltip>
      <!-- Debug button for simple view -->
      <button
        class="patrol-simple-debug-button"
        on:click={handleDebugData}
        title="Debug: Ver datos"
      >
        🐛
      </button>
    </div>
  {:else}
    <!-- Full view for preset manager and guard -->
    <!-- Drop zone left -->
    {#if dropZone === 'left'}
      <div
        class="drop-zone left"
        on:dragover={handleDragOver}
        on:drop={(e) => handleDrop(e, 'left')}
      >
        <div class="drop-indicator">Soltar aquí</div>
      </div>
    {/if}

    <!-- Main situational modifier card -->
    <div
      class="modifier-card {isDragged ? 'dragged' : ''}"
      draggable="true"
      on:dragstart={handleDragStart}
      on:dragend={handleDragEnd}
      on:dragenter={handleDragEnter}
      on:dragleave={handleDragLeave}
    >
      <!-- Situational Modifier Image -->
      <button class="modifier-image-button" on:click={handleImageClickForFullView} on:contextmenu={handleImageRightClick}>
        <img
          class="modifier-image"
          src={situationalModifier.img || 'icons/svg/upgrade.svg'}
          alt={situationalModifier.name}
        />
      </button>

      <!-- Situational Modifier Content -->
      <div class="modifier-content">
        <!-- Name -->
        <div class="modifier-header">
          <input
            class="modifier-name"
            bind:value={situationalModifier.name}
            placeholder="Nombre del modificador"
          />
        </div>

        <!-- Description -->
        <textarea
          class="modifier-description"
          bind:value={situationalModifier.description}
          placeholder="Descripción del modificador..."
          class:expanded={isExpanded}
          on:click={toggleDetails}
        ></textarea>

        <!-- Stat Effects Preview -->
        {#if situationalModifier.statEffects && Object.keys(situationalModifier.statEffects).some(key => Number(situationalModifier.statEffects[key]) !== 0)}
          <div class="modifier-stats-preview">
            <span class="modifier-stats-label">Efectos en Stats:</span>
            <div class="modifier-stats-list">
              {#each Object.entries(situationalModifier.statEffects).filter(([_, value]) => Number(value) !== 0) as [stat, value]}
                {@const statData = stats?.find(s => s.key === stat)}
                <div class="modifier-stat-item-with-image">
                  <img
                    src={statData?.img || 'icons/svg/shield.svg'}
                    alt={statData?.name || stat}
                    class="modifier-stat-image"
                  />
                  <span class="modifier-stat-name">{statData?.name || stat}:</span>
                  <span class="modifier-stat-value {Number(value) >= 0 ? 'positive' : 'negative'}">
                    {Number(value) >= 0 ? '+' : ''}{Number(value)}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="modifier-actions">
        <button class="modifier-action-button debug" on:click={handleDebugData} title="Debug: Ver datos">
          🐛
        </button>
        <button class="modifier-action-button edit" on:click={handleEditWithStopPropagation} title="Editar">
          ✏️
        </button>
        <button class="modifier-action-button chat" on:click={handleShowInChatWithStopPropagation} title="Mostrar en chat">
          💬
        </button>
        {#if inPresetManager}
          <button class="modifier-action-button use" on:click={handleUseWithStopPropagation} title="Usar en patrulla">
            ⚡
          </button>
          <button
            class="modifier-action-button activate {situationalModifier.active ? 'active' : 'inactive'}"
            on:click={handleActivateWithStopPropagation}
            title="{situationalModifier.active ? 'Retirar del guard' : 'Activar para el guard'}"
          >
            {situationalModifier.active ? '👁️' : '👁️‍🗨️'}
          </button>
          <button class="modifier-action-button remove" on:click={handleRemoveWithStopPropagation} title="Eliminar preset">
            🗑️
          </button>
        {:else}
          <button class="modifier-action-button remove" on:click={handleRemoveWithStopPropagation} title="Quitar del guard">
            ✕
          </button>
        {/if}
      </div>
    </div>

    <!-- Drop zone right -->
    {#if dropZone === 'right'}
      <div
        class="drop-zone right"
        on:dragover={handleDragOver}
        on:drop={(e) => handleDrop(e, 'right')}
      >
        <div class="drop-indicator">Soltar aquí</div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .modifier-card-container {
    position: relative;
  }

  /* Simple View Styles - same as PatrolCard for guard */
  .patrol-simple-view {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .patrol-simple-image-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    transition: transform 0.2s ease;
    display: block;
    width: 40px;
    height: 40px;
  }

  .patrol-simple-debug-button {
    background: #ff6b6b;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 4px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .patrol-simple-debug-button:hover {
    background: #ff5252;
    transform: scale(1.1);
  }

  .patrol-simple-image-button:hover {
    transform: scale(1.1);
  }

  .patrol-simple-image {
    width: 40px;
    height: 40px;
    object-fit: cover;
    background: #000000;
    border: 2px solid #9b59b6;
    border-radius: 6px;
    transition: border-color 0.2s ease;
  }

  .patrol-simple-image-button:hover .patrol-simple-image {
    border-color: #8e44ad;
  }

  /* Full Card Styles - for preset manager and guard */
  .modifier-card {
    background: #ffffff;
    border: 2px solid #9b59b6 !important;
    border-radius: 8px;
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    transition: all 0.3s ease;
    position: relative;
  }

  .modifier-card:hover {
    box-shadow: 0 4px 8px rgba(155, 89, 182, 0.3);
    transform: translateY(-2px);
  }

  .modifier-card.dragged {
    opacity: 0.5;
    transform: rotate(5deg);
  }

  .modifier-image-button {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    transition: transform 0.2s ease;
    flex-shrink: 0;
    display: block;
    width: 80px;
    height: 80px;
  }

  .modifier-image-button:hover {
    transform: scale(1.05);
  }

  .modifier-image {
    width: 80px;
    height: 80px;
    object-fit: cover;
    background: #000000;
    border: 2px solid #9b59b6 !important;
    border-radius: 6px;
  }

  .modifier-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .modifier-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .modifier-name {
    flex: 1;
    padding: 0.25rem;
    border: 1px solid #9b59b6;
    border-radius: 4px;
    font-weight: bold;
    background: transparent;
    color: #000000;
  }

  .modifier-description {
    padding: 0.25rem;
    border: 1px solid #9b59b6;
    border-radius: 4px;
    resize: none;
    background: transparent;
    color: #000000;
    min-height: 2.5rem;
    transition: height 0.3s ease;
  }

  .modifier-description.expanded {
    height: auto;
    min-height: 4rem;
  }

  .modifier-stats-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .modifier-stats-label {
    font-size: 0.8rem;
    font-weight: bold;
    color: #9b59b6 !important;
  }

  .modifier-stats-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .modifier-stat-item-with-image {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.4rem;
    background: rgba(155, 89, 182, 0.1);
    border: 1px solid #9b59b6;
    border-radius: 12px;
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .modifier-stat-image {
    width: 16px;
    height: 16px;
    object-fit: cover;
    border-radius: 2px;
  }

  .modifier-stat-name {
    color: #333333;
    font-weight: 500;
  }

  .modifier-stat-value {
    font-weight: bold;
  }

  .modifier-stat-value.positive {
    color: #28a745;
  }

  .modifier-stat-value.negative {
    color: #dc3545;
  }

  .modifier-actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: center;
  }

  .modifier-action-button {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    background: #ecf0f1;
    color: #2c3e50;
  }

  .modifier-action-button:hover {
    transform: scale(1.1);
  }

  .modifier-action-button.debug {
    background: #95a5a6;
    color: #ffffff;
  }

  .modifier-action-button.debug:hover {
    background: #7f8c8d;
  }

  .modifier-action-button.edit {
    background: #3498db;
    color: #ffffff;
  }

  .modifier-action-button.edit:hover {
    background: #2980b9;
  }

  .modifier-action-button.chat {
    background: #9b59b6;
    color: #ffffff;
  }

  .modifier-action-button.chat:hover {
    background: #8e44ad;
  }

  .modifier-action-button.use {
    background: #27ae60;
    color: #ffffff;
  }

  .modifier-action-button.use:hover {
    background: #229954;
  }

  .modifier-action-button.activate.active {
    background: #2ecc71;
    color: #ffffff;
  }

  .modifier-action-button.activate.inactive {
    background: #95a5a6;
    color: #ffffff;
  }

  .modifier-action-button.activate:hover {
    background: #27ae60;
  }

  .modifier-action-button.remove {
    background: #e74c3c;
    color: #ffffff;
  }

  .modifier-action-button.remove:hover {
    background: #c0392b;
  }

  /* Drop zones */
  .drop-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 40px;
    background: rgba(230, 126, 34, 0.2);
    border: 2px dashed #9b59b6;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .drop-zone.left {
    left: -45px;
  }

  .drop-zone.right {
    right: -45px;
  }

  .drop-zone:hover,
  .drop-zone.active {
    opacity: 1;
  }

  .drop-indicator {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-size: 0.8rem;
    color: #9b59b6;
    font-weight: bold;
  }
</style>
