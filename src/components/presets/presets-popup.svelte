<script context="module" lang="ts">
  // FilePicker and game are provided by Foundry at runtime
  declare const FilePicker: any;
  declare const game: any;
  declare const Dialog: any;
</script>

<script lang="ts">
  // Access to Foundry objects provided at runtime
  declare const FilePicker: any;
  declare const game: any;
  declare const Dialog: any;

  import UnifiedPatrolEffects from '@/components/unified/unified-patrol-effects.svelte';
  import UnifiedReputation from '@/components/unified/unified-reputation.svelte';
  import UnifiedResources from '@/components/unified/unified-resources.svelte';
  import UnifiedSituationalModifiers from '@/components/unified/unified-situational-modifiers.svelte';
  import { getStats } from '@/guard/stats';
  import type { PresetCollection, PresetItem } from '@/shared/preset';
  import {
    addPatrolEffect,
    addReputation,
    addResource,
    addSituationalModifier,
    initializePresets,
    presetsStore,
    removePatrolEffect,
    removeReputation,
    removeResource,
    removeSituationalModifier
  } from '@/stores/presets';
  import { generateUUID } from '@/utils/log';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { openPatrolEffectEditDialog, openReputationEditDialog, openResourceEditDialog } from '../../utils/dialog-manager';
  import PopupFocusManager from '../../utils/popup-focus';

  // Helper function to normalize preset types for legacy compatibility
  function normalizePresetType(type: string): 'resource' | 'reputation' | 'patrolEffect' | 'situationalModifier' {
    // Handle legacy type name
    if (type === 'temporaryModifier') {
      return 'patrolEffect';
    }
    return type as 'resource' | 'reputation' | 'patrolEffect' | 'situationalModifier';
  }

  // Function to save the active tab to localStorage
  function saveActiveTabToStorage(tab: 'resources' | 'reputations' | 'patrolEffects' | 'situationalModifiers') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('crow-nest-presets-last-tab', tab);
    }
  }

  // Function to handle create preset button click
  function handleCreatePreset() {
    if (activeTab === 'resources') {
      // Open resource dialog with empty data for creation
      openResourceEditDialog({
        id: '',
        name: '',
        value: 0,
        description: '',
        img: '',
        sourceId: ''
      });
    } else if (activeTab === 'reputations') {
      // Open reputation dialog with empty data for creation
      openReputationEditDialog({
        id: '',
        name: '',
        value: 0,
        description: '',
        img: '',
        sourceId: ''
      });
    } else if (activeTab === 'patrolEffects') {
      // Open patrol effect dialog with empty data for creation
      openPatrolEffectEditDialog({
        id: '',
        name: '',
        value: 0,
        type: 'permanent',
        statEffects: {},
        description: '',
        img: '',
        sourceId: ''
      }, false); // false = no crear como activo desde preset manager
    } else {
      // For other tabs, use the old form behavior
      showCreateForm = !showCreateForm;
    }
  }

  // Function to change tab and save to localStorage
  function changeTab(newTab: 'resources' | 'reputations' | 'patrolEffects' | 'situationalModifiers') {
    activeTab = newTab;
    saveActiveTabToStorage(newTab);
    if (!editingPreset) showCreateForm = false;
  }

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
      if (!preset.id) {
        console.warn('Preset missing id:', preset);
        return null;
      }

      // Handle new format presets (from unified components) - convert to legacy format
      if (!preset.type && !preset.data) {
        // This is a new format preset, convert it to legacy format
        const newPreset = {
          id: preset.id,
          name: preset.name || 'Sin nombre',
          type: 'unknown', // We'll determine this later
          data: {
            name: preset.name || 'Sin nombre',
            value: preset.value || 0,
            img: preset.img || '',
            sourceId: preset.sourceId || generateUUID(),
            ...preset // Copy all other properties
          }
        };

        // Determine type based on properties
        if (preset.sourceId || preset.value !== undefined) {
          if (preset.max !== undefined) {
            newPreset.type = 'resource';
          } else {
            newPreset.type = 'reputation';
          }
        }

        return newPreset;
      }

      // Handle legacy format presets
      if (!preset.type || !preset.name) {
        console.warn('Preset missing required properties:', preset);
        return null;
      }

      // Ensure data exists
      if (!preset.data) {
        preset.data = {};
      }

      // Ensure all presets have a sourceId
      if (!preset.data.sourceId) {
        preset.data.sourceId = generateUUID();
        console.log('Generated sourceId for preset:', preset.name, 'sourceId:', preset.data.sourceId);
      }

      // Sanitize statEffects for modifier types
      if (preset.type === 'patrolEffect' || preset.type === 'situationalModifier') {
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
        patrolEffects: [],
        situationalModifiers: []
      };

      if (presets && typeof presets === 'object') {
        if (Array.isArray(presets.resources)) {
          sanitized.resources = presets.resources.map(sanitizePreset).filter(p => p !== null);
        }
        if (Array.isArray(presets.reputations)) {
          sanitized.reputations = presets.reputations.map(sanitizePreset).filter(p => p !== null);
        }
        if (Array.isArray(presets.patrolEffects)) {
          sanitized.patrolEffects = presets.patrolEffects.map(sanitizePreset).filter(p => p !== null);
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
        patrolEffects: [],
        situationalModifiers: []
      };
    }
  }

  // Helper function to safely get preset property
  function safeGetPresetProperty(preset: any, property: string, defaultValue: any = '') {
    try {
      if (!preset || typeof preset !== 'object') return defaultValue;

      // Try to get from preset.data first, then from preset level, then default
      let value = defaultValue;

      if (preset.data && typeof preset.data === 'object' && preset.data[property] !== undefined) {
        value = preset.data[property];
      } else if (preset[property] !== undefined) {
        value = preset[property];
      }

      // Handle undefined or null values
      if (value === undefined || value === null || value === 'undefined') {
        return defaultValue;
      }

      return value;
    } catch (error) {
      console.warn('Error getting preset property:', error);
      return defaultValue;
    }
  }

  const dispatch = createEventDispatcher();

  export let visible = false;
  export let initialPosition: { x: number; y: number } | undefined = undefined;

  // Focus manager
  let focusManager: PopupFocusManager;

  // Expose function to create preset from existing item
  export function createPresetFromExistingItem(item: any, type: 'resource' | 'reputation' | 'patrolEffect' | 'situationalModifier') {
    createPresetFromItem(item, type);
  }

  // Expose function to update preset from existing item
  export function updatePresetFromItem(item: any, type: 'resource' | 'reputation' | 'patrolEffect' | 'situationalModifier') {
    updatePresetFromExistingItem(item, type);
  }

  let presets: PresetCollection = {
    resources: [],
    reputations: [],
    patrolEffects: [],
    situationalModifiers: []
  };

  let stats = getStats();

  // Load last active tab from localStorage or default to 'resources'
  let activeTab: 'resources' | 'reputations' | 'patrolEffects' | 'situationalModifiers' =
    (typeof localStorage !== 'undefined' && localStorage.getItem('crow-nest-presets-last-tab') as any) || 'resources';
  let popupElement: HTMLElement;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let position = initialPosition || { x: 100, y: 100 };
  let isResizing = false;
  let resizeOffset = { x: 0, y: 0 };
  let size = { width: 800, height: 600 };

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

  let newPatrolEffectForm = {
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
  let editingPresetType: 'resource' | 'reputation' | 'patrolEffect' | 'situationalModifier' | null = null;

  onMount(async () => {
    await initializePresets();

    presetsStore.subscribe(value => {
      presets = sanitizePresets(value);
    });

    // Initialize focus manager
    focusManager = PopupFocusManager.getInstance();

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

  async function saveOrCreatePreset(type: 'resource' | 'reputation' | 'patrolEffect' | 'situationalModifier') {
    console.log('[saveOrCreatePreset] Called with type:', type);
    console.log('[saveOrCreatePreset] Current presets structure:', presets);

    // Ensure presets are properly initialized
    if (!presets || typeof presets !== 'object') {
      console.error('[saveOrCreatePreset] Presets not properly initialized:', presets);
      return;
    }

    // Ensure the specific category exists
    const category = type === 'resource' ? 'resources' :
                    type === 'reputation' ? 'reputations' :
                    type === 'patrolEffect' ? 'patrolEffects' :
                    'situationalModifiers';

    if (!Array.isArray(presets[category])) {
      console.warn(`[saveOrCreatePreset] Category ${category} is not an array, initializing:`, presets[category]);
      presets[category] = [];
    }

    if (editingPreset && editingPresetType === type) {
      // We're editing an existing preset
      saveEdit();
      return;
    }

    // We're creating a new preset
    let preset: PresetItem;

    if (type === 'resource') {
      if (!newResourceForm.name.trim()) return;
      const sourceId = generateUUID();
      preset = {
        id: generateId(),
        name: newResourceForm.name,
        type: 'resource',
        description: newResourceForm.description,
        data: {
          name: newResourceForm.name,
          value: newResourceForm.value,
          description: newResourceForm.description,
          img: newResourceForm.img,
          sourceId: sourceId
        },
        createdAt: Date.now()
      };
    } else if (type === 'reputation') {
      if (!newReputationForm.name.trim()) return;
      const sourceId = generateUUID();
      preset = {
        id: generateId(),
        name: newReputationForm.name,
        type: 'reputation',
        description: newReputationForm.description,
        data: {
          name: newReputationForm.name,
          value: newReputationForm.value,
          description: newReputationForm.description,
          img: newReputationForm.img,
          sourceId: sourceId
        },
        createdAt: Date.now()
      };
    } else if (type === 'patrolEffect') {
      if (!newPatrolEffectForm.name.trim()) return;
      const sourceId = generateUUID();
      preset = {
        id: generateId(),
        name: newPatrolEffectForm.name,
        type: 'patrolEffect',
        description: newPatrolEffectForm.description,
        data: {
          name: newPatrolEffectForm.name,
          description: newPatrolEffectForm.description,
          type: newPatrolEffectForm.type,
          value: newPatrolEffectForm.value,
          duration: newPatrolEffectForm.duration,
          statEffects: newPatrolEffectForm.statEffects || {},
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

    console.log('[saveOrCreatePreset] Created preset:', preset);
    console.log('[saveOrCreatePreset] About to call add function for type:', type);

    // Call the appropriate add function based on type
    if (type === 'resource') {
      await addResource({
        name: preset.data.name,
        value: preset.data.value,
        max: preset.data.max,
        color: preset.data.color || '#ffd700',
        img: preset.data.img || '',
        groupId: undefined, // Global preset
        description: preset.data.description || '',
        active: false, // Los recursos añadidos desde preset no deben estar activos por defecto
        order: 0
      });
    } else if (type === 'reputation') {
      await addReputation({
        name: preset.data.name,
        value: preset.data.value,
        max: preset.data.max,
        color: preset.data.color || '#8b5a3c',
        img: preset.data.img || '',
        groupId: undefined, // Global preset
        description: preset.data.description || '',
        active: false, // Las reputaciones añadidas desde preset no deben estar activas por defecto
        order: 0
      });
    } else if (type === 'patrolEffect') {
      await addPatrolEffect({
        name: preset.data.name,
        description: preset.data.description || '',
        type: preset.data.type || 'buff',
        value: preset.data.value || 0,
        duration: preset.data.duration || '1 turno',
        statEffects: preset.data.statEffects || {},
        img: preset.data.img || '',
        groupId: undefined, // Global preset
        active: false, // Los efectos añadidos desde preset no deben estar activos por defecto
        order: 0
      });
    } else if (type === 'situationalModifier') {
      await addSituationalModifier({
        name: preset.data.name,
        description: preset.data.description || '',
        situation: preset.data.description || '',
        statEffects: preset.data.statEffects || {},
        img: preset.data.img || '',
        groupId: undefined, // Global preset
        active: false, // Los modificadores añadidos desde preset no deben estar activos por defecto
        order: 0
      });
    }

    console.log('[saveOrCreatePreset] Add function completed');

    // Reset form
    if (type === 'resource') {
      newResourceForm = { name: '', value: 0, description: '', img: '' };
    } else if (type === 'reputation') {
      newReputationForm = { name: '', value: 0, description: '', img: '' };
    } else if (type === 'patrolEffect') {
      newPatrolEffectForm = { name: '', description: '', type: 'buff', value: 0, duration: '1 turno', statEffects: {} as Record<string, number> };
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

  function createPatrolEffectPreset() {
    saveOrCreatePreset('patrolEffect');
  }

  function createSituationalModifierPreset() {
    saveOrCreatePreset('situationalModifier');
  }

  function usePreset(preset: PresetItem) {
    const normalizedType = normalizePresetType(preset.type);
    updatePresetUsage(preset.id, normalizedType);
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
            // Normalizar el tipo para manejar casos legacy como "temporaryModifier"
            let normalizedType = preset.type;
            if (preset.type === 'temporaryModifier') {
              normalizedType = 'patrolEffect';
            }

            // Call the appropriate remove function based on type
            if (normalizedType === 'resource') {
              removeResource(preset.id);
            } else if (normalizedType === 'reputation') {
              removeReputation(preset.id);
            } else if (normalizedType === 'patrolEffect') {
              removePatrolEffect(preset.id);
            } else if (normalizedType === 'situationalModifier') {
              removeSituationalModifier(preset.id);
            }
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

  function cleanupCorruptedPresets() {
    const dialog = new Dialog({
      title: "Limpiar Presets Corruptos",
      content: `<p>¿Estás seguro de que quieres eliminar todos los presets que aparecen como "undefined" o están corruptos?</p><p><strong>Esta acción no se puede deshacer.</strong></p>`,
      buttons: {
        yes: {
          icon: '<i class="fas fa-broom"></i>',
          label: "Sí, limpiar",
          callback: () => {
            let removedCount = 0;

            presetsStore.update(currentPresets => {
              const cleanedPresets = { ...currentPresets };

              // Limpiar recursos
              const validResources = cleanedPresets.resources.filter(preset => {
                const isValid = preset &&
                              preset.name &&
                              preset.name !== 'undefined' &&
                              preset.name.trim() !== '' &&
                              preset.data &&
                              typeof preset.data === 'object';
                if (!isValid) removedCount++;
                return isValid;
              });
              cleanedPresets.resources = validResources;

              // Limpiar reputaciones
              const validReputations = cleanedPresets.reputations.filter(preset => {
                const isValid = preset &&
                              preset.name &&
                              preset.name !== 'undefined' &&
                              preset.name.trim() !== '' &&
                              preset.data &&
                              typeof preset.data === 'object';
                if (!isValid) removedCount++;
                return isValid;
              });
              cleanedPresets.reputations = validReputations;

              // Limpiar efectos de patrulla
              const validPatrolEffects = cleanedPresets.patrolEffects.filter(preset => {
                const isValid = preset &&
                              preset.name &&
                              preset.name !== 'undefined' &&
                              preset.name.trim() !== '' &&
                              preset.data &&
                              typeof preset.data === 'object';
                if (!isValid) removedCount++;
                return isValid;
              });
              cleanedPresets.patrolEffects = validPatrolEffects;

              // Limpiar modificadores situacionales
              const validSituationalModifiers = cleanedPresets.situationalModifiers.filter(preset => {
                const isValid = preset &&
                              preset.name &&
                              preset.name !== 'undefined' &&
                              preset.name.trim() !== '' &&
                              preset.data &&
                              typeof preset.data === 'object';
                if (!isValid) removedCount++;
                return isValid;
              });
              cleanedPresets.situationalModifiers = validSituationalModifiers;

              return cleanedPresets;
            });

            // Persistir los cambios
            presetsStore.subscribe(async (presets) => {
              try {
                await persistPresets(presets);
                console.log('Cleaned presets saved successfully');
              } catch (error) {
                console.error('Error saving cleaned presets:', error);
              }
            })();

            // Mostrar notificación
            if (game?.ui?.notifications) {
              game.ui.notifications.info(`Se eliminaron ${removedCount} presets corruptos.`);
            }
          }
        },
        no: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancelar"
        }
      },
      default: "no"
    });

    dialog.render(true);
  }

  function debugPresets() {
    console.log('🔍 [DEBUG] Current presets in component:', presets);
    console.log('🔍 [DEBUG] Resources count:', presets.resources?.length || 0);
    console.log('🔍 [DEBUG] Resources:', presets.resources);
    console.log('🔍 [DEBUG] Reputations count:', presets.reputations?.length || 0);
    console.log('🔍 [DEBUG] Reputations:', presets.reputations);
    console.log('🔍 [DEBUG] PatrolEffects count:', presets.patrolEffects?.length || 0);
    console.log('🔍 [DEBUG] PatrolEffects:', presets.patrolEffects);
    console.log('🔍 [DEBUG] SituationalModifiers count:', presets.situationalModifiers?.length || 0);
    console.log('🔍 [DEBUG] SituationalModifiers:', presets.situationalModifiers);

    // Debug individual preset validity
    ['resources', 'reputations', 'patrolEffects', 'situationalModifiers'].forEach(category => {
      console.log(`🔍 [DEBUG] Checking ${category}:`);
      const categoryPresets = presets[category] || [];
      categoryPresets.forEach((preset, index) => {
        console.log(`  [${index}] Name: "${preset?.name}" | Valid: ${!!(preset && preset.name && preset.name !== 'undefined' && preset.name.trim() !== '' && preset.data && typeof preset.data === 'object')}`);
        if (!preset || !preset.name || preset.name === 'undefined') {
          console.log(`    ❌ Invalid preset:`, preset);
        }
      });
    });

    // Show notification
    if (game?.ui?.notifications) {
      game.ui.notifications.info('Debug info mostrada en consola (F12)');
    }
  }

  function editPreset(preset: PresetItem) {
    const normalizedType = normalizePresetType(preset.type);

    // For resources, use the global dialog manager
    if (normalizedType === 'resource') {
      // Convert preset format to Resource format for the global dialog
      const resource = {
        id: preset.data.sourceId || preset.id,
        name: preset.data.name,
        value: preset.data.value,
        description: preset.data.description,
        img: preset.data.img,
        sourceId: preset.data.sourceId
      };
      openResourceEditDialog(resource);
      return;
    }

    // For reputations, use the global dialog manager
    if (normalizedType === 'reputation') {
      // Convert preset format to Reputation format for the global dialog
      const reputation = {
        id: preset.data.sourceId || preset.id,
        name: preset.data.name,
        value: preset.data.value,
        description: preset.data.description,
        img: preset.data.img,
        sourceId: preset.data.sourceId
      };
      openReputationEditDialog(reputation);
      return;
    }

    // For patrol effects, use the global dialog manager
    if (normalizedType === 'patrolEffect') {
      // Convert preset format to PatrolEffect format for the global dialog
      const patrolEffect = {
        id: preset.data.sourceId || preset.id,
        name: preset.data.name,
        value: preset.data.value,
        type: preset.data.type,
        statEffects: preset.data.statEffects,
        description: preset.data.description,
        img: preset.data.img,
        sourceId: preset.data.sourceId
      };
      openPatrolEffectEditDialog(patrolEffect, false); // false = no crear como activo desde preset manager
      return;
    }

    // For other types, use the existing form-based editing
    editingPreset = preset;
    editingPresetType = normalizedType;

    // Switch to the correct tab based on normalized type
    if (normalizedType === 'patrolEffect') {
      changeTab('patrolEffects');
    } else if (normalizedType === 'situationalModifier') {
      changeTab('situationalModifiers');
    }

    // Populate form based on preset type (resources and reputations handled by global dialog)
    if (normalizedType === 'patrolEffect') {
      newPatrolEffectForm = {
        name: preset.data.name,
        description: preset.data.description || '',
        type: preset.data.type,
        value: preset.data.value,
        duration: preset.data.duration,
        statEffects: { ...safeGetStatEffects(preset.data) }
      };
    } else if (normalizedType === 'situationalModifier') {
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
    newPatrolEffectForm = { name: '', description: '', type: 'buff', value: 0, duration: '1 turno', statEffects: {} as Record<string, number> };
    newSituationalModifierForm = { name: '', description: '', img: '', statEffects: {} as Record<string, number> };
  }

  function saveEdit() {
    if (!editingPreset) return;

    console.log('SaveEdit - Before update, editingPreset.id:', editingPreset.id);
    console.log('SaveEdit - Before update, editingPreset.data.sourceId:', editingPreset.data.sourceId);

    // Normalize the preset type for consistency
    const normalizedType = normalizePresetType(editingPreset.type);

    // Update the preset directly in the store without changing the ID
    presetsStore.update(currentPresets => {
      const presetsArray = normalizedType === 'resource' ? currentPresets.resources :
                          normalizedType === 'reputation' ? currentPresets.reputations :
                          normalizedType === 'patrolEffect' ? currentPresets.patrolEffects :
                          currentPresets.situationalModifiers;

      const presetIndex = presetsArray.findIndex(p => p.id === editingPreset.id);
      if (presetIndex !== -1) {
        // Update the existing preset while preserving its ID and sourceId
        presetsArray[presetIndex] = {
          ...editingPreset, // Keep the original ID and other properties
          type: normalizedType, // Update to normalized type
          name: normalizedType === 'resource' ? newResourceForm.name :
                normalizedType === 'reputation' ? newReputationForm.name :
                normalizedType === 'patrolEffect' ? newPatrolEffectForm.name :
                newSituationalModifierForm.name,
          description: normalizedType === 'resource' ? newResourceForm.description :
                      normalizedType === 'reputation' ? newReputationForm.description :
                      normalizedType === 'patrolEffect' ? newPatrolEffectForm.description :
                      newSituationalModifierForm.description,
          data: normalizedType === 'resource' ? {
            ...editingPreset.data, // Preserve sourceId and other properties
            name: newResourceForm.name,
            value: newResourceForm.value,
            description: newResourceForm.description,
            img: newResourceForm.img
          } : normalizedType === 'reputation' ? {
            ...editingPreset.data, // Preserve sourceId and other properties
            name: newReputationForm.name,
            value: newReputationForm.value,
            description: newReputationForm.description,
            img: newReputationForm.img
          } : normalizedType === 'patrolEffect' ? {
            ...editingPreset.data, // Preserve sourceId and other properties
            name: newPatrolEffectForm.name,
            description: newPatrolEffectForm.description,
            type: newPatrolEffectForm.type,
            value: newPatrolEffectForm.value,
            duration: newPatrolEffectForm.duration,
            statEffects: newPatrolEffectForm.statEffects || {}
          } : normalizedType === 'situationalModifier' ? {
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
        console.log('SaveEdit - After update, preset.type:', presetsArray[presetIndex].type);
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
    const presetsArray = normalizedType === 'resource' ? currentPresets.resources :
                        normalizedType === 'reputation' ? currentPresets.reputations :
                        normalizedType === 'patrolEffect' ? currentPresets.patrolEffects :
                        currentPresets.situationalModifiers;

    updatedPreset = presetsArray.find(p => p.id === editingPreset.id);

    // Emit event for preset updated with the updated preset
    console.log('PresetPopup - Emitiendo evento presetUpdated:', { preset: updatedPreset || editingPreset });
    dispatch('presetUpdated', { preset: updatedPreset || editingPreset });

    // Clear editing state
    cancelEdit();
  }

  function addStatEffect(statKey: string, value: number) {
    newPatrolEffectForm.statEffects[statKey] = value;
    newPatrolEffectForm = { ...newPatrolEffectForm };
  }

  function removeStatEffect(statKey: string) {
    delete newPatrolEffectForm.statEffects[statKey];
    newPatrolEffectForm = { ...newPatrolEffectForm };
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
  async function createPresetFromItem(item: any, type: 'resource' | 'reputation' | 'patrolEffect' | 'situationalModifier') {
    console.log('Creating preset from item:', item, 'Type:', type);
    console.log('Item sourceId:', item.sourceId);
    console.log('Item key:', item.key);
    console.log('Item name:', item.name);
    console.log('Item statEffects:', item.statEffects);

    // Validar que el item tenga la estructura correcta
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item for preset creation:', item);
      return;
    }

    // Validar que presets tenga la estructura correcta
    if (!presets || typeof presets !== 'object') {
      console.warn('Invalid presets structure:', presets);
      return;
    }

    // Use the item's existing sourceId if available, otherwise generate a new one
    let sourceIdToUse;
    if (item.sourceId) {
      // Always use the existing sourceId to maintain synchronization
      sourceIdToUse = item.sourceId;
      console.log('Using existing sourceId from item:', sourceIdToUse);
    } else {
      // Generate appropriate sourceId based on type
      if (type === 'patrolEffect') {
        const nameKey = item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const effectsKey = Object.keys(item.statEffects || {}).sort().join('-');
        sourceIdToUse = `patrol-${nameKey}-${effectsKey}`;
        console.log('Generated new sourceId for patrol effect:', sourceIdToUse);
      } else if (type === 'resource') {
        sourceIdToUse = item.key || `resource-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` || generateUUID();
        console.log('Generated new sourceId for resource:', sourceIdToUse);
      } else if (type === 'reputation') {
        sourceIdToUse = item.key || `reputation-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` || generateUUID();
        console.log('Generated new sourceId for reputation:', sourceIdToUse);
      } else if (type === 'situationalModifier') {
        sourceIdToUse = item.key || `situational-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` || generateUUID();
        console.log('Generated new sourceId for situational modifier:', sourceIdToUse);
      } else {
        // Fallback for any other types
        sourceIdToUse = item.key || generateUUID();
        console.log('Generated fallback sourceId:', sourceIdToUse);
      }
    }

    // Assign the determined sourceId to the item
    item.sourceId = sourceIdToUse;
    console.log('Final sourceId for item:', item.sourceId);

    // Check if preset already exists with same sourceId
    if (item.sourceId) {
      const presetsArray = type === 'resource' ? presets.resources :
                          type === 'reputation' ? presets.reputations :
                          type === 'patrolEffect' ? presets.patrolEffects :
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
        const targetTab = type === 'resource' ? 'resources' :
                         type === 'reputation' ? 'reputations' :
                         type === 'patrolEffect' ? 'patrolEffects' :
                         'situationalModifiers';
        changeTab(targetTab);

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

    // Call the appropriate add function based on type
    if (type === 'resource') {
      await addResource({
        name: preset.data.name,
        value: preset.data.value,
        max: preset.data.max,
        color: preset.data.color || '#ffd700',
        img: preset.data.img || '',
        groupId: undefined, // Global preset
        description: preset.data.description || '',
        active: false, // Los recursos añadidos desde preset no deben estar activos por defecto
        order: 0
      });
    } else if (type === 'reputation') {
      await addReputation({
        name: preset.data.name,
        value: preset.data.value,
        max: preset.data.max,
        color: preset.data.color || '#8b5a3c',
        img: preset.data.img || '',
        groupId: undefined, // Global preset
        description: preset.data.description || '',
        active: false, // Las reputaciones añadidas desde preset no deben estar activas por defecto
        order: 0
      });
    } else if (type === 'patrolEffect') {
      await addPatrolEffect({
        name: preset.data.name,
        description: preset.data.description || '',
        type: preset.data.type || 'buff',
        value: preset.data.value || 0,
        duration: preset.data.duration || '1 turno',
        statEffects: preset.data.statEffects || {},
        img: preset.data.img || '',
        groupId: undefined, // Global preset
        active: false, // Los efectos añadidos desde preset no deben estar activos por defecto
        order: 0
      });
    } else if (type === 'situationalModifier') {
      await addSituationalModifier({
        name: preset.data.name,
        description: preset.data.description || '',
        situation: preset.data.description || '',
        statEffects: preset.data.statEffects || {},
        img: preset.data.img || '',
        groupId: undefined, // Global preset
        active: false, // Los modificadores añadidos desde preset no deben estar activos por defecto
        order: 0
      });
    }

    // Switch to the correct tab and show the new preset
    activeTab = type === 'resource' ? 'resources' :
                type === 'reputation' ? 'reputations' :
                type === 'patrolEffect' ? 'patrolEffects' :
                'situationalModifiers';

    // Dispatch event to parent component
    dispatch('presetCreated', { preset, originalItem: item });
  }

  // Function to update preset from existing item (only if it exists)
  function updatePresetFromExistingItem(item: any, type: 'resource' | 'reputation' | 'patrolEffect' | 'situationalModifier') {
    console.log('Updating preset from item:', item, 'Type:', type);

    // Validar que el item tenga la estructura correcta
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item for preset update:', item);
      return false;
    }

    // Asegurar que el item tenga un sourceId válido
    if (!item.sourceId || item.sourceId === '') {
      // Generate appropriate sourceId based on type, similar to createPresetFromItem
      if (type === 'patrolEffect') {
        const nameKey = item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const effectsKey = Object.keys(item.statEffects || {}).sort().join('-');
        item.sourceId = `patrol-${nameKey}-${effectsKey}`;
      } else if (type === 'resource') {
        item.sourceId = item.key || `resource-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` || generateUUID();
      } else if (type === 'reputation') {
        item.sourceId = item.key || `reputation-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` || generateUUID();
      } else if (type === 'situationalModifier') {
        item.sourceId = item.key || `situational-${item.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}` || generateUUID();
      } else {
        item.sourceId = item.key || generateUUID();
      }
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
                          type === 'patrolEffect' ? presets.patrolEffects :
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
        if (type === 'resource') {
          existingPreset.data = {
            ...existingPreset.data,
            name: item.name,
            value: item.value !== undefined ? item.value : existingPreset.data.value,
            description: item.description || item.details || existingPreset.data.description || '',
            img: item.img || existingPreset.data.img,
            sourceId: sourceId
          };
        } else if (type === 'reputation') {
          existingPreset.data = {
            ...existingPreset.data,
            name: item.name,
            value: item.value !== undefined ? item.value : existingPreset.data.value,
            description: item.description || item.details || existingPreset.data.description || '',
            img: item.img || existingPreset.data.img,
            sourceId: sourceId
          };
        } else if (type === 'patrolEffect') {
          existingPreset.data = {
            ...existingPreset.data,
            name: item.name,
            description: item.description || item.details || existingPreset.data.description || '',
            type: item.type || existingPreset.data.type || 'buff',
            value: item.value !== undefined ? item.value : existingPreset.data.value,
            duration: item.duration || existingPreset.data.duration || '1 turno',
            statEffects: safeGetStatEffects(item) || safeGetStatEffects(existingPreset.data),
            sourceId: sourceId
          };
        } else if (type === 'situationalModifier') {
          existingPreset.data = {
            ...existingPreset.data,
            name: item.name,
            description: item.description || item.details || existingPreset.data.description || '',
            situation: item.description || item.situation || existingPreset.data.situation,
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
    on:click|stopPropagation
    on:focus={(e) => focusManager?.setFocus(e.currentTarget)}
    on:mousedown={(e) => focusManager?.setFocus(e.currentTarget)}
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
          on:click={() => changeTab('resources')}
        >
          Recursos
        </button>
        <button
          class="tab {activeTab === 'reputations' ? 'active' : ''}"
          on:click={() => changeTab('reputations')}
        >
          Reputaciones
        </button>
        <button
          class="tab {activeTab === 'patrolEffects' ? 'active' : ''}"
          on:click={() => changeTab('patrolEffects')}
        >
          Efectos de Patrulla
        </button>
        <button
          class="tab {activeTab === 'situationalModifiers' ? 'active' : ''}"
          on:click={() => changeTab('situationalModifiers')}
        >
          Mod. Situacionales
        </button>
      </div>

      <!-- Content -->
      <div class="popup-content">
        <!-- Add button -->
        <div class="add-section">
          <button class="add-preset-btn" on:click={handleCreatePreset}>
            + Crear Preset
          </button>
          <button class="cleanup-btn" on:click={cleanupCorruptedPresets} title="Eliminar presets corruptos o undefined">
            🧹 Limpiar Corruptos
          </button>
          <button class="debug-btn" on:click={debugPresets} title="Mostrar debug de presets en consola">
            🔍 Debug
          </button>
        </div>

        <!-- Unified Components for preset management -->
        {#if activeTab === 'resources'}
          <UnifiedResources
            title="Gestión de Presets de Recursos"
            showPresets={true}
            editingResources={false}
            inPresetManager={true}
            on:updateResource={() => {}}
          />
        {:else if activeTab === 'reputations'}
          <UnifiedReputation
            title="Gestión de Presets de Reputación"
            showPresets={true}
            editingReputation={false}
            inPresetManager={true}
            on:updateReputation={() => {}}
          />
        {:else if activeTab === 'patrolEffects'}
          <UnifiedPatrolEffects
            title="Gestión de Presets de Efectos de Patrulla"
            showPresets={true}
            editingPatrolEffects={false}
            inPresetManager={true}
            on:updatePatrolEffect={() => {}}
          />
        {:else if activeTab === 'situationalModifiers'}
          <UnifiedSituationalModifiers
            title="Gestión de Presets de Modificadores Situacionales"
            showPresets={true}
            editingSituationalModifiers={false}
            inPresetManager={true}
            on:updateSituationalModifier={() => {}}
            on:removePreset={(e) => {
              console.log('PresetPopup - Removing situational modifier preset:', e.detail);
              removeSituationalModifier(e.detail);
            }}
          />
        {:else}
          <!-- Keep original forms for situationalModifiers only -->
          {#if showCreateForm}
            <div class="create-form">
              {#if false}
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
        {/if}
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

  /* Focus management - z-index boost when focused */
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
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
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

  .cleanup-btn {
    background: #ff6b35;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s ease;
  }

  .cleanup-btn:hover {
    background: #e55a2b;
  }

  .debug-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    transition: background-color 0.2s ease;
  }

  .debug-btn:hover {
    background: #5a6268;
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
