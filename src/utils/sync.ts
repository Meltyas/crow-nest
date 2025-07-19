// Real-time synchronization system for Crow Nest module
// This handles broadcasting changes to all connected players

import { MODULE_ID } from "@/constants";

export interface SyncEvent {
  type:
    | "stats"
    | "modifiers"
    | "resources"
    | "tokens"
    | "patrols"
    | "admins"
    | "reputation"
    | "groups"
    | "patrol-sheet"
    | "presets"
    | "unifiedPresets";
  action: "update" | "create" | "delete" | "command" | "show";
  data: any;
  timestamp: number;
  user: string;
  isCommand?: boolean; // Indicates this is a command for the GM to execute
}

export class SyncManager {
  private static instance: SyncManager;
  private listeners: Map<string, ((event: SyncEvent) => void)[]> = new Map();
  private eventHandlers: Map<string, (event: SyncEvent) => void> = new Map();

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  // Register a handler for specific event types
  registerEventHandler(type: string, handler: (event: SyncEvent) => void) {
    this.eventHandlers.set(type, handler);
  }

  // Clear a specific event handler
  clearEventHandler(type: string) {
    this.eventHandlers.delete(type);
  }

  // Clear all event handlers
  clearAllEventHandlers() {
    this.eventHandlers.clear();
  }

  // Register a listener for sync events
  subscribe(type: string, callback: (event: SyncEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(callback);
  }

  // Remove a listener
  unsubscribe(type: string, callback: (event: SyncEvent) => void) {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Broadcast a change to all connected players
  async broadcast(event: SyncEvent) {
    // For groups/patrols data, save directly to the main setting
    // This will trigger updateSetting hook on all clients
    if (event.type === "groups" || event.type === "patrols") {
      try {
        await (game as any).settings.set(MODULE_ID, "patrols", event.data);
      } catch (error) {
        console.error("[SyncManager] Error saving groups/patrols data:", error);
      }
    } else {
      // For other types, use the sync setting
      await this.saveSyncEvent(event);
    }

    // Don't trigger local listeners here to avoid double processing
    // The updateSetting hook will handle the sync
  }

  // Save sync event for any type that's not groups/patrols
  private async saveSyncEvent(event: SyncEvent) {
    try {
      // Create a unique event with timestamp to ensure it always triggers
      const uniqueEvent = {
        ...event,
        syncId: Date.now() + Math.random(), // Ensure uniqueness
        timestamp: Date.now(),
      };

      await (game as any).settings.set(MODULE_ID, "syncEvent", uniqueEvent);
    } catch (error) {
      console.error("[SyncManager] Error setting sync event:", error);
    }
  }

  // Handle incoming sync events from other players
  handleRemoteEvent(event: SyncEvent) {
    this.notifyLocalListeners(event);
  }

  private notifyLocalListeners(event: SyncEvent) {
    // Check for registered event handlers first
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      handler(event);
    }

    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => callback(event));
    }

    // Also notify 'all' listeners
    const allCallbacks = this.listeners.get("all");
    if (allCallbacks) {
      allCallbacks.forEach((callback) => callback(event));
    }
  }
}

// Helper function to create sync events
export function createSyncEvent(
  type: SyncEvent["type"],
  action: SyncEvent["action"],
  data: any
): SyncEvent {
  return {
    type,
    action,
    data,
    timestamp: Date.now(),
    user: game.user?.name ?? "unknown",
  };
}

// Initialize settings-based sync listener (to be called from main.ts)
export function initializeSync() {
  // The actual hook registration is done in main.ts where Hooks is available
}

// Cleanup function (no longer needed for settings-based sync)
export function cleanupSync() {
  // Settings-based sync uses Foundry's built-in hooks
  // No manual cleanup required
}
