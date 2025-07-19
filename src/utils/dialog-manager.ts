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
  const { updateResource } = await import("@/stores/presets");

  try {
    // Get the resource ID directly from the updatedResource that contains the original data
    const resourceId = updatedResource.id || updatedResource.sourceId;

    console.log("Attempting to update with ID:", resourceId);
    console.log("Full updatedResource:", updatedResource);

    if (!resourceId) {
      console.error("No resource ID found for update");
      console.error("Available properties:", Object.keys(updatedResource));
      ui.notifications?.error("Error: No se pudo identificar el recurso");
      return;
    }

    console.log("Updating resource with ID:", resourceId);

    await updateResource(resourceId, {
      name: updatedResource.name,
      value: updatedResource.value,
      description: updatedResource.description,
      img: updatedResource.img,
    });

    console.log("Resource updated successfully:", updatedResource);
    ui.notifications?.info("Recurso actualizado correctamente");

    // Close the dialog
    closeResourceEditDialog();
  } catch (error) {
    console.error("Error updating resource:", error);
    ui.notifications?.error("Error al actualizar el recurso");
  }
}
