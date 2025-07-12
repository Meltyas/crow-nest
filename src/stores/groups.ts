// Global store for groups that persists beyond component lifecycle
import { writable } from 'svelte/store';
import type { Group } from '@/shared/group';
import { SyncManager, type SyncEvent } from '@/utils/sync';
import { getPatrols, savePatrols } from '@/patrol/patrols';

// Global groups store
export const groupsStore = writable<Group[]>([]);

// Global sync handler for groups
let syncManager: SyncManager | null = null;
let isInitialized = false;

export function initializeGroupsSync() {
  if (isInitialized) return;
  
  console.log("🌍 Initializing global groups sync");
  syncManager = SyncManager.getInstance();
  
  // Load initial data
  loadGroups();
  
  // Set up persistent sync listener
  syncManager.subscribe('groups', handleGlobalGroupsSync);
  
  isInitialized = true;
  console.log("✅ Global groups sync initialized");
}

function handleGlobalGroupsSync(event: SyncEvent) {
  console.log("🌍 Global groups sync event received:", event);
  if (event.type === 'groups') {
    console.log("📥 Updating global groups store from", event.user);
    groupsStore.set(event.data);
  }
}

export function loadGroups() {
  const groups = getPatrols();
  console.log("📁 Loading groups into store:", groups.length);
  groupsStore.set(groups);
}

export async function persistGroups(groups: Group[]) {
  console.log("💾 Global groups store: Persisting", groups.length, "groups");
  
  // Save to storage
  await savePatrols(groups);
  
  // Update local store
  groupsStore.set(groups);
  
  // Broadcast to other clients
  if (syncManager) {
    syncManager.broadcast({
      type: 'groups',
      action: 'update',
      data: groups,
      timestamp: Date.now(),
      user: game.user?.name || 'Unknown'
    });
  }
}

// Cleanup function (for development)
export function destroyGroupsSync() {
  if (syncManager && isInitialized) {
    syncManager.unsubscribe('groups', handleGlobalGroupsSync);
    isInitialized = false;
    console.log("🧹 Global groups sync destroyed");
  }
}
