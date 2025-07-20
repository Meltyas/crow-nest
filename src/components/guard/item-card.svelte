<script context="module" lang="ts">
  // ChatMessage is provided by Foundry at runtime
  declare const ChatMessage: any;
  declare const FilePicker: any;
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let item: any; // GuardReputation | GuardResource | SituationalModifier
  export let index: number;
  export let type: 'reputation' | 'resource' | 'patrol-effect' | 'situational-modifier'; // Para determinar el comportamiento
  export let expandedDetails: Record<string, boolean> = {};
  export let draggedIndex: number | null = null;
  export let dropZoneVisible: Record<string, 'left' | 'right' | null> = {};
  export let inPresetManager = false; // Show activate/deactivate preset buttons when true

  const dispatch = createEventDispatcher();

  // Configuración específica por tipo
  $: config = {
    reputation: {
      imageDefault: 'icons/svg/aura.svg',
      detailsProperty: 'details',
      valueProperty: 'value',
      nameProperty: 'name',
      showQuantity: false,
      showBar: true,
      barMax: 10,
      valueLabel: 'Reputación (0-10)',
      placeholder: 'Detalles sobre tu relación con esta facción...',
      nameLabel: 'Nombre de la facción'
    },
    resource: {
      imageDefault: 'icons/svg/item-bag.svg',
      detailsProperty: 'details',
      valueProperty: 'value',
      nameProperty: 'name',
      showQuantity: true,
      showBar: false,
      barMax: null,
      valueLabel: 'Cantidad',
      placeholder: 'Descripción del recurso...',
      nameLabel: 'Nombre del recurso'
    },
    'situational-modifier': {
      imageDefault: 'icons/svg/upgrade.svg',
      detailsProperty: 'description',
      valueProperty: null, // No single value property
      nameProperty: 'name',
      showQuantity: false,
      showBar: false,
      barMax: null,
      valueLabel: null,
      placeholder: 'Descripción del modificador situacional...',
      nameLabel: 'Nombre del modificador'
    }
  }[type];

  function handleImageClick() {
    // Usar el selector de imágenes nativo de Foundry
    if (typeof FilePicker !== "undefined") {
      new FilePicker({
        type: "image",
        current: item.img || config.imageDefault,
        callback: (path: string) => {
          // Actualizar la imagen del item
          item.img = path;

          // Disparar evento para compatibilidad
          dispatch('imageClick', item);
        },
      }).render(true);
    } else {
      // Fallback si FilePicker no está disponible
      console.warn("FilePicker no está disponible");
      dispatch('imageClick', item);
    }
  }

  function handleRemove() {
    dispatch('remove', index);
  }

  function handleShowInChat() {
    if (type === 'reputation') {
      showReputationInChat();
    } else if (type === 'resource') {
      showResourceInChat();
    } else if (type === 'situational-modifier') {
      showSituationalModifierInChat();
    }
  }

  function handleCreatePreset() {
    dispatch('createPreset', item);
  }

  function handleActivatePreset() {
    dispatch('activatePreset', { id: item.id, active: !item.active });
  }

  function handleRemovePreset() {
    if (inPresetManager) {
      // En preset manager: eliminar completamente
      dispatch('removePreset', item.id);
    } else {
      // En guard: desactivar (quitar del guard)
      dispatch('activatePreset', { id: item.id, active: false });
    }
  }

  function showReputationInChat() {
    const hue = (item[config.valueProperty] / 10) * 120;
    const reputationColor = `hsl(${hue}, 70%, 50%)`;

    const detailsSection = item[config.detailsProperty] && item[config.detailsProperty].trim()
      ? `<div style="
          margin-bottom: 0.5rem;
          font-family: 'Overpass', sans-serif;
          font-size: 14px;
          line-height: 1.4;
          color: #000000;
          width: 100%;
        ">
          <p style="margin: 0;">${item[config.detailsProperty]}</p>
        </div>`
      : "";

    const content = `
      <div style="
        background: #ffffff;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        border: 1px solid #d4af37;
        border-radius: 8px;
        position: relative;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      ">
        <img src="${item.img || config.imageDefault}" alt="${item[config.nameProperty]}" style="
          background: #000000;
          width: 100%;
          aspect-ratio: 2 / 1;
          object-fit: cover;
          border-radius: 8px 8px 0 0;
          flex-shrink: 0;
          border-bottom: 2px solid #d4af37;
        " />
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
            line-height: 1.4;
          ">${item[config.nameProperty]}</div>

          ${detailsSection}

          <div style="position: relative; width: 100%;">
            <div style="
              width: 100%;
              height: 24px;
              background: #000000;
              border: 2px solid #d4af37;
              border-radius: 12px;
              position: relative;
              overflow: hidden;
              box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
            ">
              <div style="
                height: 100%;
                width: ${item[config.valueProperty] * 10}%;
                background: linear-gradient(90deg,
                  hsl(${(item[config.valueProperty] / 10) * 120}, 70%, 40%) 0%,
                  hsl(${(item[config.valueProperty] / 10) * 120}, 80%, 50%) 50%,
                  hsl(${(item[config.valueProperty] / 10) * 120}, 70%, 60%) 100%);
                transition: width 0.4s ease;
                border-radius: 0;
                position: relative;
                box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
              "></div>
              ${Array(9).fill(0).map((_, j) => {
                const position = (j + 1) * 10;
                return `<div style="
                  position: absolute;
                  top: 0;
                  bottom: 0;
                  left: ${position}%;
                  width: 2px;
                  background: linear-gradient(to bottom,
                    rgba(0, 0, 0, 0.8) 0%,
                    rgba(0, 0, 0, 0.6) 50%,
                    rgba(0, 0, 0, 0.8) 100%);
                  z-index: 1;
                  border-radius: 1px;
                  transform: rotate(2deg);
                "></div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    ChatMessage.create({
      speaker: { alias: "Los Cuervos - Reputación" },
      content: content,
      whisper: null,
    });
  }

  function showResourceInChat() {
    const detailsSection = item[config.detailsProperty] && item[config.detailsProperty].trim()
      ? `<div style="
          margin-bottom: 0.5rem;
          font-family: 'Overpass', sans-serif;
          font-size: 14px;
          line-height: 1.4;
          color: #000000;
          width: 100%;
        ">
          <p style="margin: 0;">${item[config.detailsProperty]}</p>
        </div>`
      : "";

    const chatData = {
      content: `
        <div style="
          background: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          border: 1px solid #d4af37;
          border-radius: 8px;
          position: relative;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        ">
          <img src="${item.img || config.imageDefault}" alt="${item[config.nameProperty]}" style="
            background: #000000;
            width: 100%;
            aspect-ratio: 2 / 1;
            object-fit: cover;
            border-radius: 8px 8px 0 0;
            flex-shrink: 0;
            border-bottom: 2px solid #d4af37;
          " />
          <div style="
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
            padding: 0.75rem;
            position: relative;
            align-items: flex-start;
          ">
            <div style="
              font-family: 'Eveleth';
              font-size: 1rem;
              color: #000000;
              line-height: 1.4;
            ">${item[config.nameProperty]}</div>

            ${detailsSection}

            <div style="
              display: flex;
              justify-content: flex-end;
              width: 100%;
            ">
              <span style="
                background: #374151;
                color: #d1d5db;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-weight: bold;
                font-size: 0.8rem;
                border: 1px solid #6b7280;
                min-width: 3rem;
                text-align: center;
                font-family: 'Overpass', Arial, sans-serif;
                height: 26px;
                display: flex;
                align-items: center;
                justify-content: center;
              ">${item[config.valueProperty]}</span>
            </div>
          </div>
        </div>
      `,
      speaker: { alias: "Recursos del Guardia" }
    };

    ChatMessage.create(chatData);
  }

  async function showSituationalModifierInChat() {
    // Get stats for display
    const { getStats } = await import('@/guard/stats');
    const stats = getStats();

    const detailsSection = item[config.detailsProperty] && item[config.detailsProperty].trim()
      ? `<div style="
          margin-bottom: 0.5rem;
          font-family: 'Overpass', sans-serif;
          font-size: 14px;
          line-height: 1.4;
          color: #000000;
          width: 100%;
        ">
          <p style="margin: 0;">${item[config.detailsProperty]}</p>
        </div>`
      : "";

    // Generate stat effects display
    const statEffectsSection = item.statEffects && Object.keys(item.statEffects).length > 0
      ? `<div style="
          margin-top: 0.5rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
          gap: 0.25rem;
          width: 100%;
        ">
          ${Object.entries(item.statEffects).map(([statKey, value]) => {
            const stat = stats.find(s => s.key === statKey);
            const statName = stat ? stat.name : statKey;
            const statImg = stat ? stat.img : 'icons/svg/shield.svg';
            const displayValue = Number(value) >= 0 ? `+${value}` : `${value}`;
            const valueColor = Number(value) >= 0 ? '#10b981' : '#ef4444';
            
            return `<div style="
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 0.25rem;
              padding: 0.25rem;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              background: #f9fafb;
            ">
              <img src="${statImg}" alt="${statName}" style="
                width: 20px;
                height: 20px;
                object-fit: cover;
              " />
              <span style="
                font-size: 0.7rem;
                color: #374151;
                text-align: center;
                line-height: 1;
              ">${statName}</span>
              <span style="
                font-weight: bold;
                font-size: 0.8rem;
                color: ${valueColor};
              ">${displayValue}</span>
            </div>`;
          }).join('')}
        </div>`
      : "";

    const chatData = {
      content: `
        <div style="
          background: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          border: 1px solid #d4af37;
          border-radius: 8px;
          position: relative;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        ">
          <img src="${item.img || config.imageDefault}" alt="${item[config.nameProperty]}" style="
            background: #000000;
            width: 100%;
            aspect-ratio: 2 / 1;
            object-fit: cover;
            border-radius: 8px 8px 0 0;
            flex-shrink: 0;
            border-bottom: 2px solid #d4af37;
          " />
          <div style="
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
            padding: 0.75rem;
            position: relative;
            align-items: flex-start;
          ">
            <div style="
              font-family: 'Eveleth';
              font-size: 1rem;
              color: #000000;
              line-height: 1.4;
            ">${item[config.nameProperty]}</div>

            ${detailsSection}

            ${statEffectsSection}
          </div>
        </div>
      `,
      speaker: { alias: "Modificadores Situacionales" }
    };

    ChatMessage.create(chatData);
  }

  function handleToggleDetails() {
    dispatch('toggleDetails', item.key);
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent) {
    dispatch('dragStart', { event, index });
  }

  function handleDragOver(event: DragEvent) {
    dispatch('dragOver', { event, index });
  }

  function handleDragLeave(event: DragEvent) {
    dispatch('dragLeave', { event, index });
  }

  function handleDrop(event: DragEvent) {
    dispatch('drop', { event, index });
  }

  function handleDragEnd() {
    dispatch('dragEnd');
  }

  function handleEditItem() {
    dispatch('editItem', { item, type });
  }
</script>

<div class="item-card {type}-item"
     role="listitem"
     draggable="true"
     on:dragstart={handleDragStart}
     on:dragover={handleDragOver}
     on:dragleave={handleDragLeave}
     on:drop={handleDrop}
     on:dragend={handleDragEnd}
     class:dragging={draggedIndex === index}>

  <!-- Drop zones overlays -->
  <div class="drop-zone drop-zone-left" class:show={dropZoneVisible[index] === 'left'}>
    ⬅️ Insertar antes
  </div>
    <div class="drop-zone drop-zone-right" class:show={dropZoneVisible[index] === 'right'}>
    Insertar después ➡️
  </div>

  <div class="item-display" role="button" tabindex="0"
       on:click={handleShowInChat}
       on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleShowInChat(); } }}>
    <div class="item-image-holder">
      <div class="drag-handle">🖱️</div>
      <img class="item-image" src={item.img || config.imageDefault} alt={type} />
      <!-- Edit button (always visible in item-display) -->
      <button class="edit-floating-button" on:click|stopPropagation={handleEditItem} title="Editar {type === 'resource' ? 'recurso' : 'reputación'}">
        ✏️
      </button>
      <!-- Preset Manager floating buttons -->
      {#if inPresetManager}
        <div class="preset-floating-buttons">
          <button
            class="preset-floating-button {item.active ? 'active' : ''}"
            on:click|stopPropagation={handleActivatePreset}
            title="{item.active ? 'Retirar del guard' : 'Usar en guard'}"
          >
            {item.active ? 'Retirar' : 'Usar'}
          </button>
          <button
            class="preset-floating-button remove"
            on:click|stopPropagation={handleRemovePreset}
            title="Eliminar Preset"
          >
            🗑️
          </button>
        </div>
      {:else}
        <!-- Guard interface floating buttons - only show remove for active items -->
        <div class="preset-floating-buttons">
          <button
            class="preset-floating-button remove"
            on:click|stopPropagation={handleRemovePreset}
            title="Quitar del guard"
          >
            ✕
          </button>
        </div>
      {/if}
      </div>

      <div class="item-info">
        <!-- Item name (same for both types) -->
        <div class="item-name">{item[config.nameProperty]}</div>

        {#if item[config.detailsProperty] && item[config.detailsProperty].trim()}
          <div class="item-details" class:expanded={expandedDetails[item.key]}>
            <p>{item[config.detailsProperty]}</p>
          </div>
        {/if}

        {#if config.showBar}
          <div class="item-bar-container">
            <div class="item-bar">
              <div class="item-fill" style="width: {item[config.valueProperty] * 10}%; background: linear-gradient(90deg,
                hsl({(item[config.valueProperty] / 10) * 120}, 70%, 40%) 0%,
                hsl({(item[config.valueProperty] / 10) * 120}, 80%, 50%) 50%,
                hsl({(item[config.valueProperty] / 10) * 120}, 70%, 60%) 100%);">
              </div>
              {#each Array(11) as _, j}
                <div class="item-tick" style="left: {j * 10}%;"></div>
              {/each}
            </div>
          </div>
        {/if}

        {#if config.showQuantity}
          <!-- Resource quantity at bottom right -->
          <div class="item-quantity-container">
            <span class="item-quantity">
              {item[config.valueProperty]}
            </span>
          </div>
        {/if}
      </div>
      {#if item[config.detailsProperty] && item[config.detailsProperty].trim()}
        <button class="item-details-toggle" on:click|stopPropagation={handleToggleDetails}>
          📝
        </button>
      {/if}
    </div>
</div>

<style>
  .item-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
    position: relative;
    transition: opacity 0.2s ease;
  }

  .item-card.dragging {
    opacity: 0.7;
  }

  .item-display {
    background: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    border: 1px solid #d4af37;
    border-radius: 8px;
    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    position: relative;
    flex: 1 1 auto;
  }

  .item-image-holder {
    position: relative;
    width: 100%;
    overflow: hidden;
  }

  .item-display:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }

  .item-display:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .drag-handle {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid #6b7280;
    border-radius: 50%;
    color: #f9fafb;
    font-size: 12px;
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: all 0.2s ease;
  }

  .drag-handle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .item-card.dragging .drag-handle {
    cursor: grabbing;
  }

  .drop-zone {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    background: rgba(59, 130, 246, 0.3);
    border: 2px dashed #3b82f6;
    border-radius: 8px;
    z-index: 10;
    display: none;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
    font-weight: bold;
    font-size: 12px;
    pointer-events: none;
    backdrop-filter: blur(2px);
  }

  .drop-zone-left {
    left: 0;
    background: rgba(255, 165, 0, 0.3);
    border-color: #ffa500;
    color: #ffa500;
  }

  .drop-zone-right {
    right: 0;
    background: rgba(34, 197, 94, 0.3);
    border-color: #22c55e;
    color: #22c55e;
  }

  .item-card:not(.dragging) .drop-zone.show {
    display: flex;
    pointer-events: all;
  }

  .item-image {
    background: #000000;
    width: 100%;
    aspect-ratio: 2 / 1;
    object-fit: cover;
    border-radius: 8px 8px 0 0;
    flex-shrink: 0;
    border-bottom: 2px solid #d4af37;
    max-height: 150px;
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    position: relative;
  }

  .resource-item .item-info {
    align-items: flex-start;
    justify-content: space-between;
  }

  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.5rem;
  }

  .item-name {
    font-family: "Eveleth";
    font-size: 1rem;
    color: #000000;
    line-height: 1.4;
  }

  .item-quantity-container {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }

  .item-quantity {
    background: #374151;
    color: #d1d5db;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-weight: bold;
    font-size: 0.8rem;
    border: 1px solid #6b7280;
    min-width: 3rem;
    text-align: center;
    font-family: 'Overpass', Arial, sans-serif;
    cursor: pointer;
    transition: all 0.2s ease;
    height: 26px;
  }

  .item-quantity:hover {
    background: #4b5563;
    border-color: #9ca3af;
  }

  .item-bar-container {
    position: relative;
    width: 100%;
  }

  .item-bar {
    width: 100%;
    height: 24px;
    background: #000000;
    border: 2px solid #d4af37;
    border-radius: 12px;
    position: relative;
    overflow: hidden;
    box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .item-fill {
    height: 100%;
    transition: width 0.4s ease;
    border-radius: 0;
    position: relative;
    box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.2);
  }

  .item-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: linear-gradient(to bottom,
      rgba(0, 0, 0, 0.8) 0%,
      rgba(0, 0, 0, 0.6) 50%,
      rgba(0, 0, 0, 0.8) 100%);
    z-index: 1;
    border-radius: 1px;
    transform: rotate(2deg);
  }

  .item-tick:first-child,
  .item-tick:last-child {
    opacity: 0;
  }

  .item-details-toggle {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid #6b7280;
    border-radius: 50%;
    color: #f9fafb;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    transition: all 0.2s ease;
  }

  .item-details-toggle:hover {
    background: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .item-details {
    margin-bottom: 0.5rem;
    font-family: "Overpass", sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #000000;
    width: 100%;
    transition: all 0.3s ease;
    position: relative;
  }

  .item-details:not(.expanded) {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-details.expanded {
    display: block;
  }

  .item-details p {
    margin: 0;
    min-height: 60px;
  }

  /* Floating preset buttons for item-display */
  .preset-floating-buttons {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 3;
  }

  .preset-floating-button {
    background: #d4af37;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    font-family: 'Overpass', Arial, sans-serif;
    font-weight: bold;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0.9;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .preset-floating-button:hover {
    background: #b8941f;
    opacity: 1;
    transform: translateY(-1px);
  }

  .preset-floating-button.active {
    background: #f59e0b;
  }

  .preset-floating-button.active:hover {
    background: #d97706;
  }

  .preset-floating-button.remove {
    background: #dc2626;
    color: white;
  }

  .preset-floating-button.remove:hover {
    background: #b91c1c;
  }

  .edit-floating-button {
    position: absolute;
    bottom: 8px;
    left: 8px;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid #ccc;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.9);
    cursor: pointer;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
    z-index: 10;
  }

  .edit-floating-button:hover {
    background: rgba(100, 150, 255, 0.8);
  }
</style>
