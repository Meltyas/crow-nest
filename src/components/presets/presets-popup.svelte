<script context="module" lang="ts">
  // FilePicker and game are provided by Foundry at runtime
  declare const FilePicker: any;
  declare const game: any;
</script>

<script lang="ts">
  // FilePicker and Dialog are provided by Foundry at runtime
  declare const FilePicker: any;
  declare const Dialog: any;
  
  // Access to Foundry's game object
  declare const game: any;

  import { getStats } from '@/guard/stats';
  import type { PresetCollection, PresetItem } from '@/shared/preset';
  import { addPreset, initializePresets, persistPresets, presetsStore, removePreset, updatePresetUsage } from '@/stores/presets';
  import PopupFocusManager from '@/utils/popup-focus';
  import { generateUUID } from '@/utils/log';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  // Helper function to safely get stat effects and prevent undefined iteration
  function safeGetStatEffects(data: any): Record<string, number> {
    try {
      if (!data || typeof data !== 'object') return {};
      if (!data.statEffects || typeof data.statEffects !== 'object') return {};
      return data.statEffects;
    } catch (error) {
      console.warn('Error accessing statEffects:', error);
      return {};
    }
  }

  // Helper function to safely get entries from stat effects
  function safeGetStatEffectEntries(data: any): [string, number][] {
    try {
      const statEffects = safeGetStatEffects(data);
      return Object.entries(statEffects);
    } catch (error) {
      console.warn('Error getting stat effect entries:', error);
      return [];
    }
  }

  // Helper function to sanitize preset data
  function sanitizePreset(preset: PresetItem): PresetItem {
    try {
      if (!preset || typeof preset !== 'object') {
        console.warn('Invalid preset object:', preset);
        return null;
      }

      // Ensure preset has required properties
      if (!preset.id || !preset.type || !preset.name) {
        console.warn('Preset missing required properties:', preset);
        return null;
      }

      // Ensure data exists
      if (!preset.data) {
        preset.data = {};
      }

      // Sanitize statEffects for modifier types
      if (preset.type === 'temporaryModifier' || preset.type === 'situationalModifier') {
        preset.data.statEffects = safeGetStatEffects(preset.data);
      }

      return preset;
    } catch (error) {
      console.warn('Error sanitizing preset:', error, preset);
      return null;
    }
  }

  // Helper function to sanitize preset collection
  function sanitizePresets(presets: PresetCollection): PresetCollection {
    try {
      const sanitized: PresetCollection = {
        resources: [],
        reputations: [],
        temporaryModifiers: [],
        situationalModifiers: []
      };

      if (presets && typeof presets === 'object') {
        if (Array.isArray(presets.resources)) {
          sanitized.resources = presets.resources.map(sanitizePreset).filter(p => p !== null);
        }
        if (Array.isArray(presets.reputations)) {
          sanitized.reputations = presets.reputations.map(sanitizePreset).filter(p => p !== null);
        }
        if (Array.isArray(presets.temporaryModifiers)) {
          sanitized.temporaryModifiers = presets.temporaryModifiers.map(sanitizePreset).filter(p => p !== null);
        }
        if (Array.isArray(presets.situationalModifiers)) {
          sanitized.situationalModifiers = presets.situationalModifiers.map(sanitizePreset).filter(p => p !== null);
        }
      }

      return sanitized;
    } catch (error) {
      console.warn('Error sanitizing presets collection:', error);
      return {
        resources: [],
        reputations: [],
        temporaryModifiers: [],
        situationalModifiers: []
      };
    }
  }

  // Helper function to safely get preset property
  function safeGetPresetProperty(preset: any, property: string, defaultValue: any = '') {
    try {
      if (!preset || typeof preset !== 'object') return defaultValue;
      if (!preset.data || typeof preset.data !== 'object') return defaultValue;
      return preset.data[property] || defaultValue;
    } catch (error) {
      console.warn('Error getting preset property:', error);
      return defaultValue;
    }
  }

  const dispatch = createEventDispatcher();

  export let visible = false;
  export let initialPosition: { x: number; y: number } | undefined = undefined;

  // Expose function to create preset from existing item
  export function createPresetFromExistingItem(item: any, type: 'resource' | 'reputation' | 'temporaryModifier' | 'situationalModifier') {
    createPresetFromItem(item, type);
  }

  // Expose function to update preset from existing item
  export function updatePresetFromItem(item: any, type: 'resource' | 'reputation' | 'temporaryModifier' | 'situationalModifier') {
    updatePresetFromExistingItem(item, type);
  }

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
  let isResizing = false;
  let resizeOffset = { x: 0, y: 0 };
  let size = { width: 800, height: 600 };
  let focusManager: PopupFocusManager;

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
    statEffects: {} as Record<string, number>
  };

  let newSituationalModifierForm = {
    name: '',
    description: '',
    img: '',
    statEffects: {} as Record<string, number>
  };

  let showCreateForm = false;
  let editingPreset: PresetItem | null = null;
  let editingPresetType: 'resource' | 'reputation' | 'temporaryModifier' | 'situationalModifier' | null = null;

  onMount(async () => {
    await initializePresets();
    focusManager = PopupFocusManager.getInstance();

    presetsStore.subscribe(value => {
      presets = sanitizePresets(value);
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
    // Dar focus al popup cuando se hace click
    if (popupElement) {
      focusManager.setFocus(popupElement);
    }

    // Solo manejar drag del header
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

  function handlePopupFocus() {
    // Usar el focus manager para manejar el focus
    if (popupElement && focusManager) {
      focusManager.setFocus(popupElement);
    }
  }

  function handlePopupBlur() {
    // No removemos el focus automáticamente en blur
    // El focus manager se encarga de esto cuando otro popup toma el focus
  }

  function handleResizeMouseDown(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    isResizing = true;
    const rect = popupElement.getBoundingClientRect();
    resizeOffset = {
      x: event.clientX - rect.right,
      y: event.clientY - rect.bottom
    };
  }

  function handleMouseMove(event: MouseEvent) {
    if (isDragging && popupElement) {
      const newX = event.clientX - dragOffset.x;
      const newY = event.clientY - dragOffset.y;

      position = { x: newX, y: newY };
      popupElement.style.left = `${newX}px`;
      popupElement.style.top = `${newY}px`;

      dispatch('positionChange', position);
    } else if (isResizing && popupElement) {
      const newWidth = Math.max(600, event.clientX - popupElement.getBoundingClientRect().left - resizeOffset.x);
      const newHeight = Math.max(400, event.clientY - popupElement.getBoundingClientRect().top - resizeOffset.y);

      size = { width: newWidth, height: newHeight };
      popupElement.style.width = `${newWidth}px`;
      popupElement.style.height = `${newHeight}px`;
    }
  }

  function handleMouseUp() {
    isDragging = false;
    isResizing = false;
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
      const sourceId = generateUUID();
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
          statEffects: newTemporaryModifierForm.statEffects || {},
          sourceId: sourceId
        },
        createdAt: Date.now()
      };
    } else if (type === 'situationalModifier') {
      if (!newSituationalModifierForm.name.trim()) return;
      const sourceId = generateUUID();
      preset = {
        id: generateId(),
        name: newSituationalModifierForm.name,
        type: 'situationalModifier',
        description: newSituationalModifierForm.description,
        data: {
          name: newSituationalModifierForm.name,
          description: newSituationalModifierForm.description,
          situation: newSituationalModifierForm.description, // Usar description como situation
          img: newSituationalModifierForm.img,
          statEffects: newSituationalModifierForm.statEffects || {},
          sourceId: sourceId
        },
        createdAt: Date.now()
      };
    } else {
      console.error('Unknown preset type:', type);
      return;
    }

    addPreset(preset);

    // Reset form
    if (type === 'resource') {
      newResourceForm = { name: '', value: 0, description: '', img: '' };
    } else if (type === 'reputation') {
      newReputationForm = { name: '', value: 0, description: '', img: '' };
    } else if (type === 'temporaryModifier') {
      newTemporaryModifierForm = { name: '', description: '', type: 'buff', value: 0, duration: '1 turno', statEffects: {} as Record<string, number> };
    } else if (type === 'situationalModifier') {
      newSituationalModifierForm = { name: '', description: '', img: '', statEffects: {} as Record<string, number> };
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
    // Usar Dialog de Foundry en lugar de confirm nativo
    const dialog = new Dialog({
      title: "Eliminar Preset",
      content: `<p>¿Seguro que quieres eliminar el preset "<strong>${preset.name}</strong>"?</p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-check"></i>',
          label: "Sí, eliminar",
          callback: () => {
            removePreset(preset.id, preset.type);
          }
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar",
          callback: () => {
            // No hacer nada
          }
        }
      },
      default: "no"
    });

    dialog.render(true);
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
        statEffects: { ...safeGetStatEffects(preset.data) }
      };
    } else if (preset.type === 'situationalModifier') {
      newSituationalModifierForm = {
        name: preset.data.name,
        description: preset.data.description || preset.data.situation || '',
        img: preset.data.img || '',
        statEffects: { ...safeGetStatEffects(preset.data) }
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
    newTemporaryModifierForm = { name: '', description: '', type: 'buff', value: 0, duration: '1 turno', statEffects: {} as Record<string, number> };
    newSituationalModifierForm = { name: '', description: '', img: '', statEffects: {} as Record<string, number> };
  }

  function saveEdit() {
    if (!editingPreset) return;

    console.log('SaveEdit - Before update, editingPreset.id:', editingPreset.id);
    console.log('SaveEdit - Before update, editingPreset.data.sourceId:', editingPreset.data.sourceId);

    // Update the preset directly in the store without changing the ID
    presetsStore.update(currentPresets => {
      const presetsArray = editingPreset.type === 'resource' ? currentPresets.resources :
                          editingPreset.type === 'reputation' ? currentPresets.reputations :
                          editingPreset.type === 'temporaryModifier' ? currentPresets.temporaryModifiers :
                          currentPresets.situationalModifiers;

      const presetIndex = presetsArray.findIndex(p => p.id === editingPreset.id);
      if (presetIndex !== -1) {
        // Update the existing preset while preserving its ID and sourceId
        presetsArray[presetIndex] = {
          ...editingPreset, // Keep the original ID and other properties
          name: editingPreset.type === 'resource' ? newResourceForm.name :
                editingPreset.type === 'reputation' ? newReputationForm.name :
                editingPreset.type === 'temporaryModifier' ? newTemporaryModifierForm.name :
                newSituationalModifierForm.name,
          description: editingPreset.type === 'resource' ? newResourceForm.description :
                      editingPreset.type === 'reputation' ? newReputationForm.description :
                      editingPreset.type === 'temporaryModifier' ? newTemporaryModifierForm.description :
                      newSituationalModifierForm.description,
          data: editingPreset.type === 'resource' ? {
            ...editingPreset.data, // Preserve sourceId and other properties
            name: newResourceForm.name,
            value: newResourceForm.value,
            description: newResourceForm.description,
            img: newResourceForm.img
          } : editingPreset.type === 'reputation' ? {
            ...editingPreset.data, // Preserve sourceId and other properties
            name: newReputationForm.name,
            value: newReputationForm.value,
            description: newReputationForm.description,
            img: newReputationForm.img
          } : editingPreset.type === 'temporaryModifier' ? {
            ...editingPreset.data, // Preserve sourceId and other properties
            name: newTemporaryModifierForm.name,
            description: newTemporaryModifierForm.description,
            type: newTemporaryModifierForm.type,
            value: newTemporaryModifierForm.value,
            duration: newTemporaryModifierForm.duration,
            statEffects: newTemporaryModifierForm.statEffects || {}
          } : editingPreset.type === 'situationalModifier' ? {
            ...editingPreset.data, // Preserve sourceId and other properties
            name: newSituationalModifierForm.name,
            description: newSituationalModifierForm.description,
            situation: newSituationalModifierForm.description, // Usar description como situation
            img: newSituationalModifierForm.img,
            statEffects: newSituationalModifierForm.statEffects || {}
          } : editingPreset.data
        };

        console.log('SaveEdit - After update, preset.id:', presetsArray[presetIndex].id);
        console.log('SaveEdit - After update, preset.data.sourceId:', presetsArray[presetIndex].data.sourceId);
      }

      return currentPresets;
    });

    // Persist the changes using the proper function
    presetsStore.subscribe(async (presets) => {
      try {
        await persistPresets(presets);
      } catch (error) {
        console.error('Error saving presets:', error);
      }
    })(); // Immediately invoke to run once

    // Obtener el preset actualizado del store para emitir el evento
    let updatedPreset = null;
    const currentPresets = presets; // Use the current presets from our local state
    const presetsArray = editingPreset.type === 'resource' ? currentPresets.resources :
                        editingPreset.type === 'reputation' ? currentPresets.reputations :
                        editingPreset.type === 'temporaryModifier' ? currentPresets.temporaryModifiers :
                        currentPresets.situationalModifiers;

    updatedPreset = presetsArray.find(p => p.id === editingPreset.id);

    // Emit event for preset updated with the updated preset
    console.log('PresetPopup - Emitiendo evento presetUpdated:', { preset: updatedPreset || editingPreset });
    dispatch('presetUpdated', { preset: updatedPreset || editingPreset });

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

  function addSituationalStatEffect(statKey: string, value: number) {
    newSituationalModifierForm.statEffects[statKey] = value;
    newSituationalModifierForm = { ...newSituationalModifierForm };
  }

  function removeSituationalStatEffect(statKey: string) {
    delete newSituationalModifierForm.statEffects[statKey];
    newSituationalModifierForm = { ...newSituationalModifierForm };
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

  // Function to create preset from existing item
  function createPresetFromItem(item: any, type: 'resource' | 'reputation' | 'temporaryModifier' | 'situationalModifier') {
    console.log('Creating preset from item:', item, 'Type:', type);
    console.log('Item sourceId:', item.sourceId);
    console.log('Item statEffects:', item.statEffects);

    // Validar que el item tenga la estructura correcta
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item for preset creation:', item);
      return;
    }

    // Asegurar que el item tenga un sourceId válido
    if (!item.sourceId || item.sourceId === '') {
      item.sourceId = item.key || generateUUID();
      console.log('Generated new sourceId for item:', item.sourceId);
    }

    // Validar que presets tenga la estructura correcta
    if (!presets || typeof presets !== 'object') {
      console.warn('Invalid presets structure:', presets);
      return;
    }

    // Check if preset already exists with same sourceId
    if (item.sourceId) {
      const presetsArray = type === 'resource' ? presets.resources :
                          type === 'reputation' ? presets.reputations :
                          type === 'temporaryModifier' ? presets.temporaryModifiers :
                          presets.situationalModifiers;

      // Validar que el array de presets exista
      if (!Array.isArray(presetsArray)) {
        console.warn('Invalid presets array for type:', type, presetsArray);
        return;
      }

      const existingPreset = presetsArray.find(p => p.data && p.data.sourceId === item.sourceId);

      if (existingPreset) {
        console.log('Preset already exists, updating instead of creating new:', existingPreset);
        // Update existing preset with safe data handling
        existingPreset.data = { 
          ...item,
          statEffects: safeGetStatEffects(item)
        };
        existingPreset.name = item.name;
        existingPreset.description = item.description || '';

        // Update the store
        presetsStore.update(currentPresets => {
          return { ...currentPresets };
        });

        // Switch to the correct tab and show the updated preset
        activeTab = type === 'resource' ? 'resources' :
                    type === 'reputation' ? 'reputations' :
                    type === 'temporaryModifier' ? 'temporaryModifiers' :
                    'situationalModifiers';

        dispatch('presetUpdated', { preset: existingPreset, originalItem: item });
        return;
      }
    }

    const preset: PresetItem = {
      id: generateId(),
      name: item.name,
      type: type,
      description: item.description || '',
      data: { 
        ...item,
        statEffects: safeGetStatEffects(item)
      },
      createdAt: Date.now()
    };

    console.log('Created preset:', preset);
    console.log('Created preset data:', preset.data);
    console.log('Created preset data.statEffects:', preset.data.statEffects);
    addPreset(preset);

    // Switch to the correct tab and show the new preset
    activeTab = type === 'resource' ? 'resources' :
                type === 'reputation' ? 'reputations' :
                type === 'temporaryModifier' ? 'temporaryModifiers' :
                'situationalModifiers';

    // Dispatch event to parent component
    dispatch('presetCreated', { preset, originalItem: item });
  }

  // Function to update preset from existing item (only if it exists)
  function updatePresetFromExistingItem(item: any, type: 'resource' | 'reputation' | 'temporaryModifier' | 'situationalModifier') {
    console.log('Updating preset from item:', item, 'Type:', type);

    // Validar que el item tenga la estructura correcta
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item for preset update:', item);
      return false;
    }

    // Asegurar que el item tenga un sourceId válido
    if (!item.sourceId || item.sourceId === '') {
      item.sourceId = item.key || generateUUID();
      console.log('Generated new sourceId for item during update:', item.sourceId);
    }

    // Only update if preset exists with same sourceId
    if (item.key || item.sourceId) {
      const sourceId = item.sourceId || item.key;
      
      // Validar que presets tenga la estructura correcta
      if (!presets || typeof presets !== 'object') {
        console.warn('Invalid presets structure:', presets);
        return false;
      }

      const presetsArray = type === 'resource' ? presets.resources :
                          type === 'reputation' ? presets.reputations :
                          type === 'temporaryModifier' ? presets.temporaryModifiers :
                          presets.situationalModifiers;

      // Validar que el array de presets exista
      if (!Array.isArray(presetsArray)) {
        console.warn('Invalid presets array for type:', type, presetsArray);
        return false;
      }

      const existingPreset = presetsArray.find(p => p.data && p.data.sourceId === sourceId);

      if (existingPreset) {
        console.log('Found existing preset, updating:', existingPreset);

        // Update existing preset with new data based on type
        if (type === 'situationalModifier') {
          existingPreset.data = {
            ...existingPreset.data,
            name: item.name,
            description: item.description || '',
            situation: item.description || item.situation || existingPreset.data.situation,
            img: item.img || existingPreset.data.img,
            statEffects: safeGetStatEffects(item) || safeGetStatEffects(existingPreset.data),
            sourceId: sourceId
          };
        } else {
          // For other types (resource, reputation, temporaryModifier)
          existingPreset.data = {
            ...existingPreset.data,
            name: item.name,
            value: item.value,
            description: item.details || item.description || '',
            img: item.img || existingPreset.data.img,
            statEffects: safeGetStatEffects(item) || safeGetStatEffects(existingPreset.data),
            sourceId: sourceId
          };
        }

        existingPreset.name = item.name;
        existingPreset.description = item.description || item.details || '';

        // Update the store
        presetsStore.update(currentPresets => {
          return { ...currentPresets };
        });

        // Persist changes
        presetsStore.subscribe(async (presets) => {
          try {
            await persistPresets(presets);
          } catch (error) {
            console.error('Error saving presets:', error);
          }
        })(); // Immediately invoke to run once

        dispatch('presetUpdated', { preset: existingPreset, originalItem: item });
        return true;
      }
    }

    return false;
  }

  // Export the function so it can be called from outside
  export { createPresetFromItem };
</script>

<svelte:window on:mousemove={handleMouseMove} on:mouseup={handleMouseUp} />

{#if visible}
  <div
    class="presets-popup"
    bind:this={popupElement}
    on:mousedown={handleMouseDown}
    on:focus={handlePopupFocus}
    on:blur={handlePopupBlur}
    on:click|stopPropagation
    tabindex="-1"
    style="left: {position.x}px; top: {position.y}px; width: {size.width}px; height: {size.height}px;"
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
          <button class="add-preset-btn" on:click={() => showCreateForm = !showCreateForm}>
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
                        on:input={(e) => {
                          const value = parseInt(e.currentTarget.value) || 0;
                          addStatEffect(stat.key, value);
                        }}
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
                <label>Descripción:</label>
                <textarea bind:value={newSituationalModifierForm.description} placeholder="ej: En combate, Durante la noche, etc."></textarea>
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
                        value={newSituationalModifierForm.statEffects[stat.key] || 0}
                        on:input={(e) => {
                          const value = parseInt(e.currentTarget.value) || 0;
                          addSituationalStatEffect(stat.key, value);
                        }}
                      />
                    </div>
                  {/each}
                </div>
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
        <div class="presets-list grid-layout">
          {#if activeTab === 'resources'}
            {#each presets.resources.filter(p => p && p.data) as preset}
              <div class="preset-item-card resource-item" on:dblclick={() => editPreset(preset)}>
                <img class="preset-item-image" src={safeGetPresetProperty(preset, 'img', 'icons/svg/item-bag.svg')} alt="resource" />
                <div class="preset-item-info">
                  <div class="preset-item-name">{safeGetPresetProperty(preset, 'name', preset.name || 'Sin nombre')}</div>
                  {#if safeGetPresetProperty(preset, 'description') && safeGetPresetProperty(preset, 'description').trim()}
                    <div class="preset-item-details">
                      <p>{safeGetPresetProperty(preset, 'description')}</p>
                    </div>
                  {/if}
                  <div class="preset-item-quantity-container">
                    <span class="preset-item-quantity">{safeGetPresetProperty(preset, 'value', 0)}</span>
                  </div>
                </div>
                <div class="preset-actions">
                  <button class="use-btn" on:click|stopPropagation={() => usePreset(preset)}>Usar</button>
                  <button class="delete-btn" on:click|stopPropagation={() => deletePreset(preset)}>×</button>
                </div>
              </div>
            {/each}
          {:else if activeTab === 'reputations'}
            {#each presets.reputations.filter(p => p && p.data) as preset}
              <div class="preset-item-card reputation-item" on:dblclick={() => editPreset(preset)}>
                <img class="preset-item-image" src={safeGetPresetProperty(preset, 'img', 'icons/svg/aura.svg')} alt="reputation" />
                <div class="preset-item-info">
                  <div class="preset-item-name">{safeGetPresetProperty(preset, 'name', preset.name || 'Sin nombre')}</div>
                  {#if safeGetPresetProperty(preset, 'description') && safeGetPresetProperty(preset, 'description').trim()}
                    <div class="preset-item-details">
                      <p>{safeGetPresetProperty(preset, 'description')}</p>
                    </div>
                  {/if}
                  <div class="preset-item-bar-container">
                    <div class="preset-item-bar">
                      <div class="preset-item-fill" style="width: {(safeGetPresetProperty(preset, 'value', 0) * 10)}%; background: linear-gradient(90deg,
                        hsl({(safeGetPresetProperty(preset, 'value', 0) / 10) * 120}, 70%, 40%) 0%,
                        hsl({(safeGetPresetProperty(preset, 'value', 0) / 10) * 120}, 80%, 50%) 50%,
                        hsl({(safeGetPresetProperty(preset, 'value', 0) / 10) * 120}, 70%, 60%) 100%);">
                      </div>
                      {#each Array(11) as _, j}
                        <div class="preset-item-tick" style="left: {j * 10}%;"></div>
                      {/each}
                    </div>
                  </div>
                </div>
                <div class="preset-actions">
                  <button class="use-btn" on:click|stopPropagation={() => usePreset(preset)}>Usar</button>
                  <button class="delete-btn" on:click|stopPropagation={() => deletePreset(preset)}>×</button>
                </div>
              </div>
            {/each}
          {:else if activeTab === 'temporaryModifiers'}
            {#each presets.temporaryModifiers.filter(p => p && p.data) as preset}
              <div class="preset-item-card modifier-item" on:dblclick={() => editPreset(preset)}>
                <div class="preset-item-info">
                  <div class="preset-item-name">{preset.name || 'Sin nombre'}</div>
                  <div class="preset-item-details">
                    <p><strong>Tipo:</strong> {safeGetPresetProperty(preset, 'type', 'buff')} | <strong>Duración:</strong> {safeGetPresetProperty(preset, 'duration', '1 turno')}</p>
                    {#if preset.description}
                      <p class="description">{preset.description}</p>
                    {/if}
                    {#if game?.user?.isGM && safeGetPresetProperty(preset, 'sourceId')}
                      <span class="source-id-debug">sourceId: {safeGetPresetProperty(preset, 'sourceId')}</span>
                    {/if}
                    <div class="stat-effects-preview">
                      {#each safeGetStatEffectEntries(preset.data) as [statKey, value]}
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
                </div>
                <div class="preset-actions">
                  <button class="use-btn" on:click|stopPropagation={() => usePreset(preset)}>Usar</button>
                  <button class="delete-btn" on:click|stopPropagation={() => deletePreset(preset)}>×</button>
                </div>
              </div>
            {/each}
          {:else if activeTab === 'situationalModifiers'}
            {#each presets.situationalModifiers.filter(p => p && p.data) as preset}
              <div class="preset-item-card modifier-item" on:dblclick={() => editPreset(preset)}>
                {#if safeGetPresetProperty(preset, 'img')}
                  <img class="preset-item-image-modifier" src={safeGetPresetProperty(preset, 'img')} alt="situational modifier" />
                {/if}
                <div class="preset-item-info">
                  <div class="preset-item-name">{preset.name || 'Sin nombre'}</div>
                  <div class="preset-item-details">
                    <p><strong>Descripción:</strong> {safeGetPresetProperty(preset, 'description') || safeGetPresetProperty(preset, 'situation') || ''}</p>
                    {#if game?.user?.isGM && safeGetPresetProperty(preset, 'sourceId')}
                      <span class="source-id-debug">sourceId: {safeGetPresetProperty(preset, 'sourceId')}</span>
                    {/if}
                    <div class="stat-effects-preview">
                      {#each safeGetStatEffectEntries(preset.data) as [statKey, value]}
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
                </div>
                <div class="preset-actions">
                  <button class="use-btn" on:click|stopPropagation={() => usePreset(preset)}>Usar</button>
                  <button class="delete-btn" on:click|stopPropagation={() => deletePreset(preset)}>×</button>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>

      <!-- Resize handle -->
      <div class="resize-handle" on:mousedown={handleResizeMouseDown}></div>
    </div>
{/if}

<style>
  .presets-popup {
    position: fixed;
    background: #2a2a2a;
    border: 2px solid #d4af37;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
    min-width: 600px;
    max-width: none;
    min-height: 400px;
    max-height: none;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    resize: none;
    z-index: 80;
  }

  .presets-popup.focus {
    z-index: 100 !important;
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
    overflow-x: hidden;
    height: 0; /* Force flex child to respect parent height */
  }

  /* Resize handle */
  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    background: linear-gradient(-45deg, transparent 0%, transparent 30%, #d4af37 30%, #d4af37 40%, transparent 40%, transparent 60%, #d4af37 60%, #d4af37 70%, transparent 70%);
    cursor: nw-resize;
    z-index: 10;
  }

  .resize-handle:hover {
    background: linear-gradient(-45deg, transparent 0%, transparent 30%, #f0d050 30%, #f0d050 40%, transparent 40%, transparent 60%, #f0d050 60%, #f0d050 70%, transparent 70%);
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

  /* Grid layout para todos los tabs - 3 por línea */
  .presets-list.grid-layout {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }

  /* Estilos para presets de recursos y reputaciones (estilo ItemCard) */
  .preset-item-card {
    background: #ffffff;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    border: 1px solid #d4af37;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
    min-height: 200px;
  }

  .preset-item-card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    transform: translateY(-1px);
  }

  /* Estilos específicos para modificadores */
  .preset-item-card.modifier-item {
    background: #1a1a1a;
    border: 1px solid #444;
    color: #fff;
    padding: 1rem;
    min-height: 150px;
  }

  .preset-item-card.modifier-item:hover {
    background: #2a2a2a;
    border-color: #555;
  }

  .preset-item-card.modifier-item .preset-item-name {
    color: #d4af37;
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
    margin-top: 1rem;
  }

  .preset-item-card.modifier-item .preset-item-details {
    color: #ccc;
    font-size: 0.9rem;
  }

  .preset-item-card.modifier-item .preset-item-details p {
    margin: 0.25rem 0;
    color: #ccc;
  }

  .preset-item-card.modifier-item .preset-item-details .description {
    color: #999;
    font-style: italic;
  }

  /* Imagen para modificadores situacionales */
  .preset-item-image-modifier {
    width: 100%;
    height: 80px;
    object-fit: cover;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    border: 1px solid #444;
  }

  /* Ajuste para el nombre cuando hay imagen */
  .preset-item-card.modifier-item:has(.preset-item-image-modifier) .preset-item-name {
    margin-top: 0;
  }

  /* Botones de acción para tarjetas de modificadores */
  .preset-item-card.modifier-item .preset-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 0.25rem;
    z-index: 10;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    padding: 0.25rem;
  }

  .preset-item-card.modifier-item .preset-actions .use-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
  }

  .preset-item-card.modifier-item .preset-actions .use-btn:hover {
    background: #218838;
  }

  .preset-item-card.modifier-item .preset-actions .delete-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
  }

  .preset-item-card.modifier-item .preset-actions .delete-btn:hover {
    background: #c82333;
  }

  .preset-item-image {
    background: #000000;
    width: 100%;
    aspect-ratio: 2 / 1;
    object-fit: cover;
    border-radius: 8px 8px 0 0;
    flex-shrink: 0;
    border-bottom: 2px solid #d4af37;
  }

  .preset-item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    position: relative;
    align-items: flex-start;
  }

  .preset-item-name {
    font-family: 'Eveleth', 'Overpass', Arial, sans-serif;
    font-size: 1rem;
    color: #000000;
    line-height: 1.4;
    font-weight: bold;
    margin: 0;
  }

  .preset-item-details {
    font-family: 'Overpass', sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #000000;
    width: 100%;
    margin: 0;
  }

  .preset-item-details p {
    margin: 0;
    color: #333;
  }

  /* Estilos para cantidad de recursos */
  .preset-item-quantity-container {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    margin-top: auto;
  }

  .preset-item-quantity {
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
  }

  /* Estilos para barra de reputación */
  .preset-item-bar-container {
    display: flex;
    justify-content: center;
    width: 100%;
    margin-top: auto;
  }

  .preset-item-bar {
    width: 100%;
    height: 20px;
    background: #374151;
    border-radius: 10px;
    position: relative;
    overflow: hidden;
    border: 1px solid #6b7280;
  }

  .preset-item-fill {
    height: 100%;
    border-radius: 10px;
    transition: width 0.3s ease;
    position: relative;
  }

  .preset-item-tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.3);
  }

  /* Botones de acción para tarjetas */
  .preset-item-card .preset-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 0.25rem;
    z-index: 10;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    padding: 0.25rem;
  }

  .preset-item-card .preset-actions .use-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
  }

  .preset-item-card .preset-actions .use-btn:hover {
    background: #218838;
  }

  .preset-item-card .preset-actions .delete-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
  }

  .preset-item-card .preset-actions .delete-btn:hover {
    background: #c82333;
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

  .source-id-debug {
    display: inline-block;
    background: #dc3545;
    color: white;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-size: 0.7rem;
    font-family: monospace;
    margin-top: 0.25rem;
    opacity: 0.8;
  }
</style>
