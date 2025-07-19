import type { Reputation, Resource } from "@/shared/preset";
import { writable } from "svelte/store";

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
        active: true // New resources created via dialog should be active
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
        active: true // New reputations created via dialog should be active
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
