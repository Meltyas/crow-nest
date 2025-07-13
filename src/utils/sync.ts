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
    // Send to all players via Foundry's socket system
    if (game.socket) {
      // In Foundry VTT, game.socket.emit() should broadcast to all connected clients
      // Let's try the standard approach first
      game.socket.emit(`module.${MODULE_ID}`, event);
    }

    // Also trigger local listeners
    this.notifyLocalListeners(event);
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

// Test function specifically for patrol-sheet events
export function testPatrolSheetSync() {
  if (!game.socket) {
    return;
  }

  const testEvent: SyncEvent = {
    type: "patrol-sheet",
    action: "show",
    data: {
      group: {
        id: "test-patrol",
        name: "Test Patrol",
        officer: null,
        soldiers: [],
        mods: {},
      },
      labels: { test: "patrol sheet test" },
    },
    timestamp: Date.now(),
    user: game.user?.name || "unknown",
  };

  game.socket.emit(`module.crow-nest`, testEvent);
}

// Initialize socket listener
export function initializeSync() {
  const syncManager = SyncManager.getInstance();

  if (game.socket) {
    // Setup the main listener
    const mainChannel = `module.${MODULE_ID}`;

    // IMPORTANT: Remove any existing listener first to prevent duplicates
    game.socket.off(mainChannel);

    // Register the main socket listener
    game.socket.on(mainChannel, (event: SyncEvent) => {
      syncManager.handleRemoteEvent(event);
    });
  }
}

// Cleanup function to remove all listeners
export function cleanupSync() {
  if (game.socket) {
    const mainChannel = `module.${MODULE_ID}`;
    game.socket.off(mainChannel);
  }
}
