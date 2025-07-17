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
    | "patrol-sheet";
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

  // Get number of registered event handlers (for debugging)
  getEventHandlerCount(): number {
    return this.eventHandlers.size;
  }

  // Debug methods to inspect sync state
  getListeners() {
    return this.listeners;
  }

  getEventHandlers() {
    return this.eventHandlers;
  }

  getListenerCount(type?: string): number {
    if (type) {
      return this.listeners.get(type)?.length || 0;
    }
    return Array.from(this.listeners.values()).reduce(
      (total, callbacks) => total + callbacks.length,
      0
    );
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
    console.log("[SyncManager] Broadcasting event directly:", event);

    // For groups/patrols data, save directly to the main setting
    // This will trigger updateSetting hook on all clients
    if (event.type === "groups" || event.type === "patrols") {
      console.log("[SyncManager] Saving groups/patrols data directly");
      try {
        await (game as any).settings.set(MODULE_ID, "patrols", event.data);
        console.log("[SyncManager] Groups/patrols data saved successfully");
      } catch (error) {
        console.error("[SyncManager] Error saving groups/patrols data:", error);
      }
    } else {
      // For other types, use the sync setting
      console.log("[SyncManager] Using sync setting for type:", event.type);
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

      console.log("[SyncManager] Setting sync event in Foundry settings");
      await (game as any).settings.set(MODULE_ID, "syncEvent", uniqueEvent);
      console.log("[SyncManager] Sync event set successfully");
    } catch (error) {
      console.error("[SyncManager] Error setting sync event:", error);
    }
  }

  // Handle incoming sync events from other players
  handleRemoteEvent(event: SyncEvent) {
    console.log("[SyncManager] Received remote event:", event);
    this.notifyLocalListeners(event);
  }

  private notifyLocalListeners(event: SyncEvent) {
    console.log(
      "[SyncManager] notifyLocalListeners called with event type:",
      event.type
    );

    // Check for registered event handlers first
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      console.log("[SyncManager] Found event handler for type:", event.type);
      handler(event);
    } else {
      console.log("[SyncManager] No event handler found for type:", event.type);
    }

    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      console.log(
        "[SyncManager] Found",
        callbacks.length,
        "listeners for type:",
        event.type
      );
      callbacks.forEach((callback) => callback(event));
    } else {
      console.log("[SyncManager] No listeners found for type:", event.type);
    }

    // Also notify 'all' listeners
    const allCallbacks = this.listeners.get("all");
    if (allCallbacks) {
      console.log(
        "[SyncManager] Found",
        allCallbacks.length,
        "listeners for type: all"
      );
      allCallbacks.forEach((callback) => callback(event));
    }

    console.log("[SyncManager] Current listeners map:", this.listeners);
    console.log(
      "[SyncManager] Current event handlers map:",
      this.eventHandlers
    );
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
  console.log("[Sync] Settings-based sync system setup completed");
  // The actual hook registration is done in main.ts where Hooks is available
}

// Cleanup function (no longer needed for settings-based sync)
export function cleanupSync() {
  console.log(
    "[Sync] Cleanup called - settings-based sync requires no cleanup"
  );
  // Settings-based sync uses Foundry's built-in hooks
  // No manual cleanup required
}
