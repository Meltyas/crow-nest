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

  console.log("[GroupsStore] Initializing groups sync...");
  syncManager = SyncManager.getInstance();

  // Load initial data
  loadGroups();

  // Set up persistent sync listener
  syncManager.subscribe("groups", handleGlobalGroupsSync);
  console.log("[GroupsStore] Groups sync initialized successfully");

  isInitialized = true;
}

function handleGlobalGroupsSync(event: SyncEvent) {
  console.log("[GroupsStore] handleGlobalGroupsSync received event:", event);
  if (event.type === "groups") {
    console.log(
      "[GroupsStore] Updating store with new groups data:",
      event.data
    );
    groupsStore.set(event.data);
    console.log("[GroupsStore] Store updated successfully");
  }
}

export function loadGroups() {
  const groups = getPatrols();
  groupsStore.set(groups);
}

export async function persistGroups(groups: Group[]) {
  console.log("persistGroups called with:", groups);
  console.log(
    "persistGroups temporaryModifiers details:",
    groups.map((g) => ({
      id: g.id,
      name: g.name,
      temporaryModifiers: g.temporaryModifiers,
      temporaryModifiersKeys: Object.keys(g.temporaryModifiers || {}),
    }))
  );

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
