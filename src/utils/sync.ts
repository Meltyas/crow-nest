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

  // Get number of registered event handlers (for debugging)
  getEventHandlerCount(): number {
    return this.eventHandlers.size;
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

    console.log("🔍 SyncManager: Checking socket availability...");
    console.log("📊 Socket info:", {
      socketExists: !!game.socket,
      userId: game.user?.id,
      userName: game.user?.name,
      isGM: game.user?.isGM,
      moduleId: MODULE_ID,
      channel: `module.${MODULE_ID}`,
    });

    // Send to all players via Foundry's socket system
    if (game.socket) {
      console.log(`📡 SyncManager: Emitting to channel: module.${MODULE_ID}`);

      // In Foundry VTT, game.socket.emit() should broadcast to all connected clients
      // Let's try the standard approach first
      game.socket.emit(`module.${MODULE_ID}`, event);
      console.log("✅ SyncManager: Event sent via socket");

      // Also log connected users for debugging
      console.log(
        "👥 Connected users:",
        game.users?.map((u) => ({ id: u.id, name: u.name, active: u.active }))
      );
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

    // Check for registered event handlers first
    const handler = this.eventHandlers.get(event.type);
    if (handler) {
      console.log(`🎯 SyncManager: Found event handler for ${event.type}`);
      handler(event);
    }

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
  console.log("🎯 Current user:", game.user?.name, "isGM:", game.user?.isGM);
  const syncManager = SyncManager.getInstance();

  if (game.socket) {
    console.log("✅ SyncManager: Socket available, setting up listener");
    console.log("🔌 Socket object:", game.socket);

    // Test if socket is actually working
    const testChannel = `module.${MODULE_ID}-test`;
    game.socket.on(testChannel, (data) => {
      console.log("🧪 Test socket received:", data);
    });

    // Setup the main listener
    const mainChannel = `module.${MODULE_ID}`;
    console.log(`🎯 Setting up listener for: ${mainChannel}`);

    // Remove any existing listener first
    game.socket.off(mainChannel);

    game.socket.on(mainChannel, (event: SyncEvent) => {
      console.log("📨 SyncManager: Socket received event", event);
      console.log(
        "📨 Received by user:",
        game.user?.name,
        "isGM:",
        game.user?.isGM
      );
      console.log("📨 Event details:", {
        type: event.type,
        action: event.action,
        timestamp: event.timestamp,
        sender: event.user,
      });

      // Special handling for patrol-sheet events
      if (event.type === "patrol-sheet" && event.action === "show") {
        console.log("🚨 PATROL SHEET SHOW EVENT RECEIVED!");
        console.log("🚨 Data:", event.data);
        console.log("🚨 Current user is GM:", game.user?.isGM);
        console.log("🚨 Should show patrol sheet to player");
      }

      syncManager.handleRemoteEvent(event);
    });

    console.log(`🎯 SyncManager: Listening on ${mainChannel}`);
    console.log("✅ SyncManager: Socket listener fully configured");

    // Test the socket immediately
    setTimeout(() => {
      console.log("🧪 Testing socket emission...");
      game.socket?.emit(testChannel, {
        test: "initialization test",
        user: game.user?.name,
      });
    }, 1000);
  } else {
    console.error("❌ SyncManager: No socket available during initialization");
  }
}
