import type { Reputation, Resource, PatrolEffect, SituationalModifier } from "@/shared/preset";
import { writable, get } from "svelte/store";

// Store for managing global dialogs
interface DialogState {
  resourceEditDialog: {
    visible: boolean;
    resource: Resource | null;
  };
  reputationEditDialog: {
    visible: boolean;
    reputation: Reputation | null;
  };
  patrolEffectEditDialog: {
    visible: boolean;
    patrolEffect: PatrolEffect | null;
  };
  situationalModifierEditDialog: {
    visible: boolean;
    situationalModifier: SituationalModifier | null;
    fromPresetManager: boolean;
  };
}

const initialState: DialogState = {
  resourceEditDialog: {
    visible: false,
    resource: null,
  },
  reputationEditDialog: {
    visible: false,
    reputation: null,
  },
  patrolEffectEditDialog: {
    visible: false,
    patrolEffect: null,
  },
  situationalModifierEditDialog: {
    visible: false,
    situationalModifier: null,
    fromPresetManager: false,
  },
};

export const dialogStore = writable<DialogState>(initialState);

// Resource Edit Dialog functions
export function openResourceEditDialog(resource: Resource) {
  console.log("Opening resource edit dialog with:", resource);
  console.log("Resource has ID:", resource.id);
  console.log("Resource has sourceId:", resource.sourceId);

  dialogStore.update((state) => {
    const newState = {
      ...state,
      resourceEditDialog: {
        visible: true,
        resource,
      },
    };
    console.log("Updated dialog store state:", newState);
    return newState;
  });
}

export function closeResourceEditDialog() {
  dialogStore.update((state) => ({
    ...state,
    resourceEditDialog: {
      visible: false,
      resource: null,
    },
  }));
}

// Reputation Edit Dialog functions (for future use)
export function openReputationEditDialog(reputation: Reputation) {
  dialogStore.update((state) => ({
    ...state,
    reputationEditDialog: {
      visible: true,
      reputation,
    },
  }));
}

export function closeReputationEditDialog() {
  dialogStore.update((state) => ({
    ...state,
    reputationEditDialog: {
      visible: false,
      reputation: null,
    },
  }));
}

// Patrol Effect Edit Dialog functions
export function openPatrolEffectEditDialog(patrolEffect: PatrolEffect) {
  dialogStore.update((state) => ({
    ...state,
    patrolEffectEditDialog: {
      visible: true,
      patrolEffect,
    },
  }));
}

export function closePatrolEffectEditDialog() {
  dialogStore.update((state) => ({
    ...state,
    patrolEffectEditDialog: {
      visible: false,
      patrolEffect: null,
    },
  }));
}

// Situational Modifier Edit Dialog functions
export function openSituationalModifierEditDialog(situationalModifier: SituationalModifier, fromPresetManager: boolean = false) {
  dialogStore.update((state) => ({
    ...state,
    situationalModifierEditDialog: {
      visible: true,
      situationalModifier,
      fromPresetManager, // Add context information
    },
  }));
}

export function closeSituationalModifierEditDialog() {
  dialogStore.update((state) => ({
    ...state,
    situationalModifierEditDialog: {
      visible: false,
      situationalModifier: null,
      fromPresetManager: false,
    },
  }));
}

// Save handlers that can be used from anywhere
export async function handleResourceSave(updatedResource: any) {
  console.log("Global save resource handler called with:", updatedResource);

  // Import the presets store dynamically to avoid circular imports
  const { updateResource, addResource } = await import("@/stores/presets");

  try {
    // Get the resource ID directly from the updatedResource that contains the original data
    const resourceId = updatedResource.id || updatedResource.sourceId;

    console.log("Attempting to save with ID:", resourceId);
    console.log("Full updatedResource:", updatedResource);

    // Check if this is a creation (empty ID) or update
    if (!resourceId || resourceId === '') {
      console.log("Creating new resource (no ID provided)");
      
      // Create new resource - set active: true so it appears in guard interface
      await addResource({
        name: updatedResource.name,
        value: updatedResource.value || 0,
        img: updatedResource.img || '',
        sourceId: `resource-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        groupId: undefined, // Global preset
        description: updatedResource.description || '',
        active: true, // New resources created via dialog should be active
        guardOrder: 0, // Add at the beginning of guard list
        presetOrder: 0 // Add at the beginning of preset list
      });

      console.log("Resource created successfully:", updatedResource);
      ui.notifications?.info("Recurso creado correctamente");
    } else {
      console.log("Updating existing resource with ID:", resourceId);

      await updateResource(resourceId, {
        name: updatedResource.name,
        value: updatedResource.value,
        description: updatedResource.description,
        img: updatedResource.img,
      });

      console.log("Resource updated successfully:", updatedResource);
      ui.notifications?.info("Recurso actualizado correctamente");
    }

    // Close the dialog
    closeResourceEditDialog();
  } catch (error) {
    console.error("Error saving resource:", error);
    ui.notifications?.error("Error al guardar el recurso");
  }
}

export async function handleReputationSave(updatedReputation: any) {
  console.log("Global save reputation handler called with:", updatedReputation);

  // Import the presets store dynamically to avoid circular imports
  const { updateReputation, addReputation } = await import("@/stores/presets");

  try {
    // Get the reputation ID directly from the updatedReputation that contains the original data
    const reputationId = updatedReputation.id || updatedReputation.sourceId;

    console.log("Attempting to save with ID:", reputationId);
    console.log("Full updatedReputation:", updatedReputation);

    // Check if this is a creation (empty ID) or update
    if (!reputationId || reputationId === '') {
      console.log("Creating new reputation (no ID provided)");
      
      // Create new reputation - set active: true so it appears in guard interface
      await addReputation({
        name: updatedReputation.name,
        value: updatedReputation.value || 0,
        img: updatedReputation.img || '',
        sourceId: `reputation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        groupId: undefined, // Global preset
        description: updatedReputation.description || '',
        active: true, // New reputations created via dialog should be active
        guardOrder: 0, // Add at the beginning of guard list
        presetOrder: 0 // Add at the beginning of preset list
      });

      console.log("Reputation created successfully:", updatedReputation);
      ui.notifications?.info("Reputación creada correctamente");
    } else {
      console.log("Updating existing reputation with ID:", reputationId);

      await updateReputation(reputationId, {
        name: updatedReputation.name,
        value: updatedReputation.value,
        description: updatedReputation.description,
        img: updatedReputation.img,
      });

      console.log("Reputation updated successfully:", updatedReputation);
      ui.notifications?.info("Reputación actualizada correctamente");
    }

    // Close the dialog
    closeReputationEditDialog();
  } catch (error) {
    console.error("Error saving reputation:", error);
    ui.notifications?.error("Error al guardar la reputación");
  }
}

// Patrol Effect save handler
export async function handlePatrolEffectSave(updatedPatrolEffect: any) {
  console.log("Global save patrol effect handler called with:", updatedPatrolEffect);

  // Import the presets store dynamically to avoid circular imports
  const { updatePatrolEffect, addPatrolEffect } = await import("@/stores/presets");

  try {
    // Get the patrol effect ID directly from the updatedPatrolEffect that contains the original data
    const patrolEffectId = updatedPatrolEffect.id || updatedPatrolEffect.sourceId;

    console.log("Attempting to save with ID:", patrolEffectId);
    console.log("Full updatedPatrolEffect:", updatedPatrolEffect);

    // Check if this is a creation (empty ID) or update
    if (!patrolEffectId || patrolEffectId === '') {
      console.log("Creating new patrol effect (no ID provided)");
      
      // Generate a consistent sourceId
      const sourceId = `patrol-effect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new patrol effect - set active: true so it appears in guard interface
      await addPatrolEffect({
        name: updatedPatrolEffect.name,
        statEffects: updatedPatrolEffect.statEffects || {},
        img: updatedPatrolEffect.img || '',
        sourceId: sourceId,
        groupId: undefined, // Global preset
        description: updatedPatrolEffect.description || '',
        active: true, // New patrol effects created via dialog should be active
        presetOrder: 0 // Add at the beginning of preset list
      });

      console.log("Patrol effect created successfully:", updatedPatrolEffect);
      ui.notifications?.info("Efecto de patrulla creado correctamente");
      
      // Emit event for auto-application to pending group
      const newPatrolEffectEvent = new CustomEvent('patrol-effect-created', {
        detail: {
          name: updatedPatrolEffect.name,
          description: updatedPatrolEffect.description,
          statEffects: updatedPatrolEffect.statEffects,
          img: updatedPatrolEffect.img,
          sourceId: sourceId
        }
      });
      window.dispatchEvent(newPatrolEffectEvent);
    } else {
      console.log("Updating existing patrol effect with ID:", patrolEffectId);

      await updatePatrolEffect(patrolEffectId, {
        name: updatedPatrolEffect.name,
        statEffects: updatedPatrolEffect.statEffects,
        description: updatedPatrolEffect.description,
        img: updatedPatrolEffect.img,
      });

      console.log("Patrol effect updated successfully:", updatedPatrolEffect);
      ui.notifications?.info("Efecto de patrulla actualizado correctamente");
      
      // Emit event for patrol effect updates (for groups to update existing effects)
      const updatedPatrolEffectEvent = new CustomEvent('patrol-effect-updated', {
        detail: {
          id: patrolEffectId,
          name: updatedPatrolEffect.name,
          description: updatedPatrolEffect.description,
          statEffects: updatedPatrolEffect.statEffects,
          img: updatedPatrolEffect.img,
          sourceId: updatedPatrolEffect.sourceId
        }
      });
      window.dispatchEvent(updatedPatrolEffectEvent);
    }

    // Close the dialog
    closePatrolEffectEditDialog();
  } catch (error) {
    console.error("Error saving patrol effect:", error);
    ui.notifications?.error("Error al guardar el efecto de patrulla");
  }
}

// Situational Modifier save handler
export async function handleSituationalModifierSave(updatedSituationalModifier: any) {
  console.log("Dialog manager - Handling situational modifier save:", updatedSituationalModifier);
  
  // Import the presets store dynamically to avoid circular imports
  const { updateSituationalModifier, addSituationalModifier } = await import("@/stores/presets");

  try {
    // Get the context information from the dialog store
    const dialogState = get(dialogStore);
    const fromPresetManager = dialogState.situationalModifierEditDialog.fromPresetManager;
    
    // Get the situational modifier ID directly from the updatedSituationalModifier that contains the original data
    const modifierId = updatedSituationalModifier.id || updatedSituationalModifier.sourceId;

    console.log("Attempting to save with ID:", modifierId);
    console.log("Full updatedSituationalModifier:", updatedSituationalModifier);
    console.log("fromPresetManager:", fromPresetManager);

    // Check if this is a creation (empty ID) or update
    if (!modifierId || modifierId === '') {
      console.log("Creating new situational modifier (no ID provided)");
      
      // Generate a consistent sourceId
      const sourceId = `situational-modifier-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create new situational modifier
      // If from preset manager: active: false (goes to preset pool)
      // If from guard: active: true (goes directly to guard)
      await addSituationalModifier({
        name: updatedSituationalModifier.name,
        statEffects: updatedSituationalModifier.statEffects || {},
        img: updatedSituationalModifier.img || 'icons/svg/upgrade.svg',
        sourceId: sourceId,
        groupId: undefined, // Global preset
        description: updatedSituationalModifier.description || '',
        active: !fromPresetManager, // Active only if NOT from preset manager
        presetOrder: 0 // Add at the beginning of preset list
      });

      console.log("Situational modifier created successfully:", updatedSituationalModifier);
      ui.notifications?.info("Modificador situacional creado correctamente");
      
      // Emit event for auto-application to pending group
      const newModifierEvent = new CustomEvent('situational-modifier-created', {
        detail: {
          name: updatedSituationalModifier.name,
          description: updatedSituationalModifier.description,
          statEffects: updatedSituationalModifier.statEffects,
          img: updatedSituationalModifier.img,
          sourceId: sourceId
        }
      });
      window.dispatchEvent(newModifierEvent);
    } else {
      console.log("Updating existing situational modifier with ID:", modifierId);
      console.log("Updates to apply:", {
        name: updatedSituationalModifier.name,
        statEffects: updatedSituationalModifier.statEffects,
        description: updatedSituationalModifier.description,
        img: updatedSituationalModifier.img,
      });

      await updateSituationalModifier(modifierId, {
        name: updatedSituationalModifier.name,
        statEffects: updatedSituationalModifier.statEffects,
        description: updatedSituationalModifier.description,
        img: updatedSituationalModifier.img,
      });

      console.log("Situational modifier updated successfully:", updatedSituationalModifier);
      ui.notifications?.info("Modificador situacional actualizado correctamente");
      
      // Emit event for situational modifier updates (for groups to update existing modifiers)
      const updatedModifierEvent = new CustomEvent('situational-modifier-updated', {
        detail: {
          id: modifierId,
          name: updatedSituationalModifier.name,
          description: updatedSituationalModifier.description,
          statEffects: updatedSituationalModifier.statEffects,
          img: updatedSituationalModifier.img,
          sourceId: updatedSituationalModifier.sourceId
        }
      });
      window.dispatchEvent(updatedModifierEvent);
    }

    // Close the dialog
    closeSituationalModifierEditDialog();
  } catch (error) {
    console.error("Error saving situational modifier:", error);
    ui.notifications?.error("Error al guardar el modificador situacional");
  }
}
