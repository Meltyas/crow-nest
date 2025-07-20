<script context="module" lang="ts">
  // ChatMessage is provided by Foundry at runtime
  declare const ChatMessage: any;
  declare const FilePicker: any;
</script>

<script lang="ts">
  import Tooltip from '@/components/tooltip.svelte';
  import { getStats } from '@/guard/stats';
  import { createEventDispatcher } from 'svelte';

  export let patrolEffect: any; // PatrolEffect object
  export let index: number;
  export let expandedDetails: Record<string, boolean> = {};
  export let draggedIndex: number | null = null;
  export let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};
  export let inPresetManager = false; // Show activate/deactivate preset buttons when true
  export let simpleView = false; // Show only image with tooltip for groups view

  const dispatch = createEventDispatcher();
  const stats = getStats();

  function handleImageClick() {
    if (simpleView) {
      // En groups (simple view): click muestra en chat, doble click edita
      return; // Los eventos se manejan directamente en el template
    }

    // Usar el selector de imágenes nativo de Foundry
    if (typeof FilePicker !== "undefined") {
      new FilePicker({
        type: "image",
        current: patrolEffect.img || 'icons/svg/aura.svg',
        callback: (path: string) => {
          // Actualizar la imagen del patrol effect
          patrolEffect.img = path;

          // Disparar evento para compatibilidad
          dispatch('imageClick', patrolEffect);
        },
      }).render(true);
    } else {
      // Fallback si FilePicker no está disponible
      console.warn("FilePicker no está disponible");
      dispatch('imageClick', patrolEffect);
    }
  }

  function handleImageClickForFullView(event: MouseEvent) {
    event.stopPropagation();
    handleImageClick();
  }

  function handleEditWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleEdit();
  }

  function handleShowInChatWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleShowInChat();
  }

  function handleCreatePresetWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleCreatePreset();
  }

  function handleRemoveWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleRemove();
  }

  function handleActivatePresetWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleActivatePreset();
  }

  function handleRemovePresetWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleRemovePreset();
  }

  function handleUseWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleUse();
  }

  function handleImageClickWithStopPropagation(event: MouseEvent) {
    event.stopPropagation();
    handleImageClickSimple();
  }

  function handleImageClickSimple() {
    // Para simple view: click simple muestra en chat
    console.log('PatrolCard - handleImageClickSimple called, simpleView:', simpleView);
    showPatrolEffectInChat();
  }

  function handleImageRightClickSimple(event: MouseEvent) {
    event.preventDefault(); // Prevenir menú contextual del navegador
    event.stopPropagation(); // Evitar que el evento llegue al grupo
    console.log('PatrolCard - handleImageRightClickSimple called, shiftKey:', event.shiftKey);

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
    console.log('PatrolCard - handleRemove called, dispatching remove event with index:', index);
    dispatch('remove', index);
  }

  function handleEdit() {
    console.log('PatrolCard - handleEdit called, dispatching edit event with:', patrolEffect);
    dispatch('edit', patrolEffect);
  }

  function handleShowInChat() {
    showPatrolEffectInChat();
  }

  function handleCreatePreset() {
    dispatch('createPreset', patrolEffect);
  }

  function handleActivatePreset() {
    dispatch('activatePreset', { id: patrolEffect.id, active: !patrolEffect.active });
  }

  function handleRemovePreset() {
    if (inPresetManager) {
      // En preset manager: eliminar completamente
      dispatch('removePreset', patrolEffect.id);
    } else {
      // En guard: desactivar (quitar del guard)
      dispatch('activatePreset', { id: patrolEffect.id, active: false });
    }
  }

  function handleUse() {
    dispatch('use', patrolEffect);
  }

  function handleDebugData(event: MouseEvent) {
    event.stopPropagation();
    console.log('=== PATROL EFFECT DEBUG DATA ===');
    console.log('Full patrolEffect object:', patrolEffect);
    console.log('patrolEffect.img:', patrolEffect.img);
    console.log('patrolEffect.name:', patrolEffect.name);
    console.log('patrolEffect.description:', patrolEffect.description);
    console.log('patrolEffect.statEffects:', patrolEffect.statEffects);
    console.log('patrolEffect keys:', Object.keys(patrolEffect));
    console.log('typeof patrolEffect:', typeof patrolEffect);
    console.log('JSON.stringify(patrolEffect):', JSON.stringify(patrolEffect, null, 2));

    // También mostrar en chat para fácil visualización
    const debugContent = `
      <div style="background: #f8f9fa; padding: 1rem; border: 2px solid #dc3545; border-radius: 8px; font-family: monospace; white-space: pre-wrap;">
        <h3 style="color: #dc3545; margin-top: 0;">🐛 DEBUG: Patrol Effect Data</h3>
        <strong>Object Keys:</strong> ${Object.keys(patrolEffect).join(', ')}

        <strong>Name:</strong> ${patrolEffect.name || 'undefined'}
        <strong>Description:</strong> ${patrolEffect.description || 'undefined'}
        <strong>Image:</strong> ${patrolEffect.img || 'undefined'}
        <strong>Stat Effects:</strong> ${JSON.stringify(patrolEffect.statEffects, null, 2)}

        <strong>Full Object:</strong>
        ${JSON.stringify(patrolEffect, null, 2)}
      </div>
    `;

    ChatMessage.create({
      speaker: { alias: "🐛 DEBUG" },
      content: debugContent,
    });
  }

  function showPatrolEffectInChat() {
    const detailsSection = patrolEffect.description && patrolEffect.description.trim()
      ? `<div style="
          margin-bottom: 0.5rem;
          font-family: 'Overpass', sans-serif;
          font-size: 14px;
          line-height: 1.4;
          color: #000000;
          width: 100%;
        ">
          <p style="margin: 0;">${patrolEffect.description}</p>
        </div>`
      : "";

    // Create stat effects display
    const statEffectsDisplay = Object.keys(patrolEffect.statEffects || {}).length > 0
      ? `<div style="
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid #d4af37;
          border-radius: 4px;
        ">
          <div style="font-size: 12px; font-weight: bold; color: #d4af37; margin-bottom: 0.25rem;">
            Efectos en Stats:
          </div>
          ${Object.entries(patrolEffect.statEffects || {})
            .filter(([_, value]) => Number(value) !== 0)
            .map(([stat, value]) => `
              <div style="font-size: 11px; color: #666;">
                ${stat}: ${Number(value) > 0 ? '+' : ''}${Number(value)}
              </div>
            `).join('')}
        </div>`
      : "";

    // Get the image URL and ensure it's valid for Foundry
    let imageUrl = patrolEffect.img || 'icons/svg/aura.svg';
    // If it's a relative path, ensure it's properly formatted for Foundry
    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('data:') && !imageUrl.startsWith('icons/')) {
      // This might be a user-uploaded image, ensure it has proper path
      if (!imageUrl.startsWith('/')) {
        imageUrl = `modules/crow-nest/${imageUrl}`;
      }
    }

    const content = `
      <div style="
        background: #ffffff;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        border: 2px solid #9b59b6;
        border-radius: 8px;
        position: relative;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      ">
        <img src="${imageUrl}" alt="${patrolEffect.name}" style="
          background: #000000;
          width: 100%;
          aspect-ratio: 2 / 1;
          object-fit: cover;
          border-radius: 6px 6px 0 0;
          flex-shrink: 0;
          border-bottom: 2px solid #9b59b6;
        " onerror="this.src='icons/svg/aura.svg';" />
        <div style="
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
          padding: 0.75rem;
          position: relative;
        ">
          <div style="
            font-family: 'Eveleth';
            font-size: 1rem;
            color: #000000;
            font-weight: bold;
            text-align: center;
            margin-bottom: 0.25rem;
          ">
            🛡️ ${patrolEffect.name}
          </div>
          ${detailsSection}
          ${statEffectsDisplay}
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: { alias: "Efecto de Patrulla" },
      content: content,
    });
  }

  function toggleDetails() {
    const key = patrolEffect.key || patrolEffect.id || index.toString();
    expandedDetails[key] = !expandedDetails[key];
    expandedDetails = { ...expandedDetails };
  }

  // Handle drag and drop functions
  function handleDragStart(event: DragEvent) {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index.toString());
    }
    dispatch('dragStart', index);
  }

  function handleDragEnd() {
    dispatch('dragEnd');
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
  }

  function handleDragEnter(event: DragEvent) {
    event.preventDefault();
    dispatch('dragEnter', index);
  }

  function handleDragLeave() {
    dispatch('dragLeave', index);
  }

  function handleDrop(event: DragEvent, position: 'left' | 'right') {
    event.preventDefault();
    if (event.dataTransfer) {
      const draggedIdx = parseInt(event.dataTransfer.getData('text/plain'));
      dispatch('drop', { draggedIndex: draggedIdx, targetIndex: index, position });
    }
  }

  $: isDragged = draggedIndex === index;
  $: dropZone = dropZoneVisible[index.toString()];
  $: isExpanded = expandedDetails[patrolEffect.key || patrolEffect.id || index.toString()];

  // Generate tooltip content for simple view
  $: tooltipContent = (() => {
    if (!simpleView) return '';

    const name = patrolEffect.name || 'Sin nombre';
    const description = patrolEffect.description ? `<p style="margin: 0.5rem 0; color: #ffffff; font-size: 0.9em;">${patrolEffect.description}</p>` : '';

    const statsDisplay = Object.keys(patrolEffect.statEffects || {}).length > 0
      ? `<div style="margin-top: 0.5rem;">
          <div style="font-weight: bold; color: #d4af37; margin-bottom: 0.3rem; font-size: 0.9em;">Efectos en Stats:</div>
          ${Object.entries(patrolEffect.statEffects || {})
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

<div class="patrol-card-container">
  {#if simpleView}
    <!-- Simple view for groups - just image with tooltip -->
    <div class="patrol-simple-view">
      <Tooltip content={tooltipContent}>
        <button
          class="patrol-simple-image-button"
          on:click={handleImageClickWithStopPropagation}
          on:contextmenu={handleImageRightClickSimple}
        >
          <img
            class="patrol-simple-image"
            src={patrolEffect.img || 'icons/svg/aura.svg'}
            alt={patrolEffect.name}
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

    <!-- Main patrol effect card -->
    <div
      class="patrol-card {isDragged ? 'dragged' : ''}"
      draggable="true"
      on:dragstart={handleDragStart}
      on:dragend={handleDragEnd}
      on:dragenter={handleDragEnter}
      on:dragleave={handleDragLeave}
    >
      <!-- Patrol Effect Image -->
      <button class="patrol-image-button" on:click={handleImageClickForFullView} on:contextmenu={handleImageRightClick}>
        <img
          class="patrol-image"
          src={patrolEffect.img || 'icons/svg/aura.svg'}
          alt={patrolEffect.name}
        />
      </button>

      <!-- Patrol Effect Content -->
      <div class="patrol-content">
        <!-- Name -->
        <div class="patrol-header">
          <input
            class="patrol-name"
            bind:value={patrolEffect.name}
            placeholder="Nombre del efecto"
          />
        </div>

        <!-- Description -->
        <textarea
          class="patrol-description"
          bind:value={patrolEffect.description}
          placeholder="Descripción del efecto..."
          class:expanded={isExpanded}
          on:click={toggleDetails}
        ></textarea>

        <!-- Stat Effects Preview -->
        {#if patrolEffect.statEffects && Object.keys(patrolEffect.statEffects).some(key => Number(patrolEffect.statEffects[key]) !== 0)}
          <div class="patrol-stats-preview">
            <span class="patrol-stats-label">Efectos en Stats:</span>
            <div class="patrol-stats-list">
              {#each Object.entries(patrolEffect.statEffects).filter(([_, value]) => Number(value) !== 0) as [stat, value]}
                {@const statData = stats?.find(s => s.key === stat)}
                <div class="patrol-stat-item-with-image">
                  <img
                    src={statData?.img || 'icons/svg/shield.svg'}
                    alt={statData?.name || stat}
                    class="patrol-stat-image"
                  />
                  <span class="patrol-stat-name">{statData?.name || stat}:</span>
                  <span class="patrol-stat-value {Number(value) >= 0 ? 'positive' : 'negative'}">
                    {Number(value) >= 0 ? '+' : ''}{Number(value)}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Action Buttons -->
      <div class="patrol-actions">
        <button class="patrol-action-button debug" on:click={handleDebugData} title="Debug: Ver datos">
          🐛
        </button>
        <button class="patrol-action-button edit" on:click={handleEditWithStopPropagation} title="Editar">
          ✏️
        </button>
        <button class="patrol-action-button chat" on:click={handleShowInChatWithStopPropagation} title="Mostrar en chat">
          💬
        </button>
        {#if inPresetManager}
          <button class="patrol-action-button use" on:click={handleUseWithStopPropagation} title="Usar en patrulla">
            ⚡
          </button>
          <button
            class="patrol-action-button activate {patrolEffect.active ? 'active' : 'inactive'}"
            on:click={handleActivatePresetWithStopPropagation}
            title={patrolEffect.active ? 'Desactivar' : 'Activar'}
          >
            {patrolEffect.active ? '👁️' : '🚫'}
          </button>
          <button class="patrol-action-button remove" on:click={handleRemovePresetWithStopPropagation} title="Eliminar">
            🗑️
          </button>
        {:else}
          <button class="patrol-action-button preset" on:click={handleCreatePresetWithStopPropagation} title="Crear preset">
            📋
          </button>
          <button class="patrol-action-button remove" on:click={handleRemoveWithStopPropagation} title="Eliminar">
            🗑️
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
  .patrol-card-container {
    position: relative;
    margin-bottom: 0.75rem;
  }

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

  .patrol-card {
    background: #ffffff;
    border: 2px solid #9b59b6;
    border-radius: 8px;
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    transition: all 0.3s ease;
    position: relative;
  }

  .patrol-card:hover {
    box-shadow: 0 4px 8px rgba(155, 89, 182, 0.3);
    transform: translateY(-2px);
  }

  .patrol-card.dragged {
    opacity: 0.5;
    transform: rotate(5deg);
  }

  .patrol-image-button {
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

  .patrol-image-button:hover {
    transform: scale(1.05);
  }

  .patrol-image {
    width: 80px;
    height: 80px;
    object-fit: cover;
    background: #000000;
    border: 2px solid #9b59b6;
    border-radius: 6px;
  }

  .patrol-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .patrol-header {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .patrol-name {
    flex: 1;
    padding: 0.25rem;
    border: 1px solid #9b59b6;
    border-radius: 4px;
    font-weight: bold;
    background: transparent;
    color: #000000;
  }

  .patrol-stats-preview {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .patrol-stats-label {
    font-size: 0.8rem;
    font-weight: bold;
    color: #9b59b6;
  }

  .patrol-stats-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .patrol-stat-item-with-image {
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

  .patrol-stat-image {
    width: 16px;
    height: 16px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .patrol-stat-name {
    font-weight: bold;
    color: #9b59b6;
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  .patrol-stat-value {
    font-weight: bold;
    font-size: 0.8rem;
    margin-left: 0.2rem;
  }

  .patrol-stat-value.positive {
    color: #28a745;
  }

  .patrol-stat-value.negative {
    color: #dc3545;
  }

  .patrol-description {
    resize: vertical;
    min-height: 40px;
    max-height: 40px;
    padding: 0.25rem;
    border: 1px solid #9b59b6;
    border-radius: 4px;
    background: transparent;
    color: #000000;
    font-size: 0.85rem;
    transition: max-height 0.3s ease;
  }

  .patrol-description.expanded {
    max-height: 120px;
  }

  .patrol-actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .patrol-action-button {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  .patrol-action-button.debug {
    background: #ff6b6b;
    color: white;
  }

  .patrol-action-button.debug:hover {
    background: #ff5252;
  }

  .patrol-action-button.edit {
    background: #3498db;
    color: white;
  }

  .patrol-action-button.edit:hover {
    background: #2980b9;
  }

  .patrol-action-button.use {
    background: #9b59b6;
    color: white;
  }

  .patrol-action-button.use:hover {
    background: #8e44ad;
  }

  .patrol-action-button.chat {
    background: #2ecc71;
    color: white;
  }

  .patrol-action-button.chat:hover {
    background: #27ae60;
  }

  .patrol-action-button.preset {
    background: #f39c12;
    color: white;
  }

  .patrol-action-button.preset:hover {
    background: #e67e22;
  }

  .patrol-action-button.activate.active {
    background: #2ecc71;
    color: white;
  }

  .patrol-action-button.activate.inactive {
    background: #95a5a6;
    color: white;
  }

  .patrol-action-button.activate:hover {
    opacity: 0.8;
  }

  .patrol-action-button.remove {
    background: #e74c3c;
    color: white;
  }

  .patrol-action-button.remove:hover {
    background: #c0392b;
  }

  .drop-zone {
    position: absolute;
    width: 3px;
    height: 100%;
    top: 0;
    background: rgba(155, 89, 182, 0.3);
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drop-zone.left {
    left: -6px;
  }

  .drop-zone.right {
    right: -6px;
  }

  .drop-indicator {
    background: #9b59b6;
    color: white;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.7rem;
    font-weight: bold;
    transform: rotate(-90deg);
    white-space: nowrap;
  }
</style>
