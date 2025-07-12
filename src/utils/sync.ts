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
    | "groups";
  action: "update" | "create" | "delete" | "command";
  data: any;
  timestamp: number;
  user: string;
  isCommand?: boolean; // Indicates this is a command for the GM to execute
}

export interface SyncCommand {
  type:
    | "stats"
    | "modifiers"
    | "resources"
    | "tokens"
    | "patrols"
    | "admins"
    | "reputation"
    | "groups";
  action: "update" | "create" | "delete";
  data: any;
  timestamp: number;
  user: string;
}

export class SyncManager {
  private static instance: SyncManager;
  private listeners: Map<string, ((event: SyncEvent) => void)[]> = new Map();

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
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
    console.log(
      "🔄 SyncManager: Broadcasting event",
      event.type,
      event.action,
      event.data
    );

    // Send to all players via Foundry's socket system
    if (game.socket) {
      await game.socket.emit(`module.${MODULE_ID}`, event);
      console.log("📡 SyncManager: Event sent via socket");
    } else {
      console.warn("⚠️ SyncManager: No socket available");
    }

    // Also trigger local listeners
    this.notifyLocalListeners(event);
  }

  // Handle incoming sync events from other players
  handleRemoteEvent(event: SyncEvent) {
    console.log(
      "📥 SyncManager: Received remote event",
      event.type,
      event.action,
      event.data
    );
    this.notifyLocalListeners(event);
  }

  private notifyLocalListeners(event: SyncEvent) {
    console.log("🔔 SyncManager: Notifying local listeners for", event.type);

    const callbacks = this.listeners.get(event.type);
    if (callbacks) {
      console.log(
        `📢 SyncManager: Found ${callbacks.length} callbacks for ${event.type}`
      );
      callbacks.forEach((callback) => callback(event));
    } else {
      console.log(`📭 SyncManager: No callbacks found for ${event.type}`);
    }

    // Also notify 'all' listeners
    const allCallbacks = this.listeners.get("all");
    if (allCallbacks) {
      console.log(
        `📢 SyncManager: Found ${allCallbacks.length} 'all' callbacks`
      );
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

// Initialize socket listener
export function initializeSync() {
  console.log("🚀 SyncManager: Initializing synchronization system");
  const syncManager = SyncManager.getInstance();

  if (game.socket) {
    console.log("✅ SyncManager: Socket available, setting up listener");
    game.socket.on(`module.${MODULE_ID}`, (event: SyncEvent) => {
      console.log("📨 SyncManager: Socket received event", event);
      syncManager.handleRemoteEvent(event);
    });
    console.log(`🎯 SyncManager: Listening on module.${MODULE_ID}`);
  } else {
    console.error("❌ SyncManager: No socket available during initialization");
  }
}
