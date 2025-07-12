// Global store for groups that persists beyond component lifecycle
import { getPatrols, savePatrols } from "@/patrol/patrols";
import type { Group } from "@/shared/group";
import { SyncManager, type SyncEvent } from "@/utils/sync";
import { writable } from "svelte/store";

// Global groups store
export const groupsStore = writable<Group[]>([]);

// Global sync handler for groups
let syncManager: SyncManager | null = null;
let isInitialized = false;

export function initializeGroupsSync() {
  if (isInitialized) return;

  syncManager = SyncManager.getInstance();

  // Load initial data
  loadGroups();

  // Set up persistent sync listener
  syncManager.subscribe("groups", handleGlobalGroupsSync);

  isInitialized = true;
}

function handleGlobalGroupsSync(event: SyncEvent) {
  if (event.type === "groups") {
    groupsStore.set(event.data);
  }
}

export function loadGroups() {
  const groups = getPatrols();
  groupsStore.set(groups);
}

export async function persistGroups(groups: Group[]) {
  // Save to storage
  await savePatrols(groups);

  // Update local store
  groupsStore.set(groups);

  // Broadcast to other clients
  if (syncManager) {
    syncManager.broadcast({
      type: "groups",
      action: "update",
      data: groups,
      timestamp: Date.now(),
      user: game.user?.name || "Unknown",
    });
  }
}

// Cleanup function (for development)
export function destroyGroupsSync() {
  if (syncManager && isInitialized) {
    syncManager.unsubscribe("groups", handleGlobalGroupsSync);
    isInitialized = false;
  }
}
