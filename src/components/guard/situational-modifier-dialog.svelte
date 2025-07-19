<script context="module" lang="ts">
  // Foundry globals
  declare const Dialog: any;
  declare const FilePicker: any;
</script>

<script lang="ts">
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import { generateUUID } from '@/utils/log';
  import { createEventDispatcher } from 'svelte';

  export let stats: GuardStat[] = [];
  export let modifier: GuardModifier | null = null; // null for create, object for edit
  export let isOpen = false;

  const dispatch = createEventDispatcher();

  let isEditing = false;
  
  // Local modifier data
  let localModifier: GuardModifier = {
    key: '',
    name: '',
    description: '',
    mods: {},
    state: 'neutral',
    img: 'icons/svg/upgrade.svg',
    sourceId: ''
  };

  // Initialize local data when modifier prop changes
  $: if (modifier) {
    isEditing = true;
    localModifier = { ...modifier, mods: { ...modifier.mods } };
  } else {
    isEditing = false;
    const uniqueId = generateUUID();
    localModifier = {
      key: uniqueId,
      name: '',
      description: '',
      mods: {},
      state: 'neutral',
      img: 'icons/svg/upgrade.svg',
      sourceId: uniqueId
    };
  }

  function openImagePicker() {
    if (typeof FilePicker !== "undefined") {
      new FilePicker({
        type: "image",
        current: localModifier.img,
        callback: (path: string) => {
          localModifier.img = path;
          // Update image in dialog if it's open
          const img = document.querySelector('#modifier-image-preview');
          if (img) {
            (img as HTMLImageElement).src = path;
          }
        }
      }).render(true);
    }
  }

  function createPresetFromModifier() {
    console.log('Dialog - Creating preset from modifier:', localModifier);
    // Dispatch event to create preset from this modifier
    dispatch('createPreset', localModifier);
    // NO cerramos el diálogo para que el usuario pueda seguir editando
  }

  function closeDialogAndDispatch(eventType: 'create' | 'update', data: GuardModifier) {
    dispatch(eventType, data);
    handleClose();
  }

  function openDialog() {
    if (!Dialog) {
      console.error("Dialog not available");
      return;
    }

    // Build stat modifiers HTML
    const statModifiersHTML = stats.map(stat => `
      <div class="stat-modifier">
        <label for="mod-${stat.key}">${stat.name}:</label>
        <input type="number" id="mod-${stat.key}" name="mod-${stat.key}" value="${localModifier.mods[stat.key] || 0}" />
      </div>
    `).join('');

    new Dialog({
      title: isEditing ? 'Editar Modificador Situacional' : 'Crear Modificador Situacional',
      content: `
        <form>
          <div class="form-group">
            <label>Imagen</label>
            <div class="image-section">
              <button type="button" class="image-button" id="image-picker">
                <img id="modifier-image-preview" src="${localModifier.img}" alt="Modifier" style="width: 64px; height: 64px; object-fit: cover;" />
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="modifier-name">Nombre</label>
            <input type="text" id="modifier-name" name="name" value="${localModifier.name}" placeholder="Nombre del modificador" />
          </div>

          <div class="form-group">
            <label for="modifier-description">Descripción</label>
            <textarea id="modifier-description" name="description" placeholder="Descripción del modificador">${localModifier.description}</textarea>
          </div>

          <div class="form-group">
            <label for="modifier-state">Estado</label>
            <select id="modifier-state" name="state">
              <option value="positive" ${localModifier.state === 'positive' ? 'selected' : ''}>Positivo</option>
              <option value="neutral" ${localModifier.state === 'neutral' ? 'selected' : ''}>Neutral</option>
              <option value="negative" ${localModifier.state === 'negative' ? 'selected' : ''}>Negativo</option>
            </select>
          </div>

          <div class="form-group">
            <label>Modificadores de Estadísticas</label>
            <div class="stats-grid">
              ${statModifiersHTML}
            </div>
          </div>

        </form>

        <style>
          .form-group {
            margin-bottom: 1rem;
          }

          .form-group label {
            font-weight: bold;
            margin-bottom: 0.5rem;
            display: block;
          }

          .image-section {
            display: flex;
            justify-content: center;
          }

          .image-button {
            background: none;
            border: 2px solid #666;
            border-radius: 4px;
            padding: 4px;
            cursor: pointer;
            transition: border-color 0.2s;
          }

          .image-button:hover {
            border-color: #4a90e2;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 0.5rem;
            padding: 0.5rem;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: #f9f9f9;
          }

          .stat-modifier {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            justify-content: space-between;
          }

          input, textarea, select {
            padding: 0.5rem;
            border: 1px solid #ccc;
            border-radius: 4px;
            font-family: inherit;
          }

          textarea {
            min-height: 80px;
            resize: vertical;
          }
        </style>
      `,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: isEditing ? 'Actualizar' : 'Crear',
          callback: (html: any) => {
            const form = html[0].querySelector("form");
            
            // Update localModifier with form values
            localModifier.name = form.name.value.trim();
            localModifier.description = form.description.value.trim();
            localModifier.state = form.state.value;
            
            // Update stat modifiers
            stats.forEach(stat => {
              const input = form[`mod-${stat.key}`];
              if (input) {
                const value = parseInt(input.value) || 0;
                if (value !== 0) {
                  localModifier.mods[stat.key] = value;
                } else {
                  delete localModifier.mods[stat.key];
                }
              }
            });

            // Dispatch the appropriate event
            if (isEditing) {
              closeDialogAndDispatch('update', localModifier);
            } else {
              closeDialogAndDispatch('create', localModifier);
            }
          }
        },
        preset: {
          icon: '<i class="fas fa-save"></i>',
          label: 'Crear Preset',
          callback: (html: any) => {
            const form = html[0].querySelector("form");
            
            // Update localModifier with current form values
            localModifier.name = form.name.value.trim();
            localModifier.description = form.description.value.trim();
            localModifier.state = form.state.value;
            
            // Update stat modifiers
            stats.forEach(stat => {
              const input = form[`mod-${stat.key}`];
              if (input) {
                const value = parseInt(input.value) || 0;
                if (value !== 0) {
                  localModifier.mods[stat.key] = value;
                } else {
                  delete localModifier.mods[stat.key];
                }
              }
            });

            createPresetFromModifier();
            // Return false to prevent dialog from closing
            return false;
          }
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: 'Cancelar'
        }
      },
      render: (html: any) => {
        // Set up event listeners after dialog is rendered
        const imagePicker = html[0].querySelector('#image-picker');
        if (imagePicker) {
          imagePicker.addEventListener('click', openImagePicker);
        }
      },
      default: 'confirm'
    }).render(true);
  }

  // Watch for isOpen changes
  $: if (isOpen) {
    openDialog();
  }

  // Handle close event
  function handleClose() {
    isOpen = false;
    dispatch('close');
  }
</script>

<!-- This component doesn't render anything directly -->
<!-- All rendering is handled by the Foundry Dialog -->