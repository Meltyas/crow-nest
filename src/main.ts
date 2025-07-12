import Hud from "@/components/hud/hud.svelte";
import {
  patrolSheetManager,
  PatrolSheetManager,
} from "@/components/patrol-sheet/patrol-sheet";
import {
  MODULE_ID,
  SETTING_ADMINS,
  SETTING_LOG,
  SETTING_MODIFIERS,
  SETTING_PATROLS,
  SETTING_REPUTATION,
  SETTING_RESOURCES,
  SETTING_STATS,
} from "@/constants";
import { getPatrols } from "@/patrol/patrols";
import { initializeSync, SyncManager } from "@/utils/sync";
import "./styles/global.pcss";

Hooks.once("init", () => {
  console.log("Crow Nest | Initializing module");
  game.settings.register(MODULE_ID, SETTING_STATS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_LOG, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_MODIFIERS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_RESOURCES, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_PATROLS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_ADMINS, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  game.settings.register(MODULE_ID, SETTING_REPUTATION, {
    scope: "world",
    config: false,
    type: Array,
    default: [],
  });
  // Game tokens (Despair and Cheers) - GM only
  game.settings.register(MODULE_ID, "gameTokens", {
    scope: "world",
    config: false,
    type: Object,
    default: { despair: 0, cheers: 0 },
  });
});

Hooks.once("ready", () => {
  console.log("Crow Nest | Ready");

  // Initialize real-time synchronization
  console.log("Crow Nest | Initializing sync system");
  initializeSync();

  // Initialize patrol sheet manager
  console.log("Crow Nest | Initializing patrol sheet system");
  patrolSheetManager; // Esto inicializa la instancia

  // Expose API for external access
  (game.modules.get(MODULE_ID) as any).api = {
    getGroups: () => getPatrols(),
    patrolSheetManager: patrolSheetManager,
    debugPatrolSheets: () => patrolSheetManager.debugState(),
    debugSyncHandlers: () => patrolSheetManager.debugSyncHandlers(),
    testSyncCommunication: () => patrolSheetManager.testSyncCommunication(),
    testSocketReception: () => patrolSheetManager.testSocketReception(),
    testSocketDirectly: () => patrolSheetManager.testSocketDirectly(),
    clearPatrolPositions: () => patrolSheetManager.clearStoredPositions(),
    checkLocalStorage: () => {
      const activeSheets = localStorage.getItem("crow-nest-open-patrol-sheets");
      const positions = localStorage.getItem("crow-nest-patrol-positions");
      console.log("🔍 LocalStorage Debug:");
      console.log(
        "Active sheets:",
        activeSheets ? JSON.parse(activeSheets) : null
      );
      console.log(
        "Position history:",
        positions ? JSON.parse(positions) : null
      );
      return {
        activeSheets: activeSheets ? JSON.parse(activeSheets) : null,
        positions: positions ? JSON.parse(positions) : null,
      };
    },
  };

  // Create HUD
  console.log("Crow Nest | Creating HUD");
  const container = document.createElement("div");
  container.style.position = "absolute";
  document.body.appendChild(container);
  new Hud({ target: container });
  console.log("Crow Nest | HUD created successfully");
});

Hooks.on("getActorSheetHeaderButtons", (sheet: any, buttons: any[]) => {
  // Removed old OrganizationStatsApp - now using the new tab system in HUD
});

Hooks.on("dropCanvasData", async (canvas: any, data: any) => {
  if (data.type !== "CrowPatrol") return;
  const patrol = getPatrols().find((p) => p.id === data.patrolId);
  if (!patrol) return false;

  const members = [] as any[];
  if (patrol.officer) members.push(patrol.officer);
  members.push(...patrol.soldiers);

  const grid = canvas.grid.size;
  let offsetX = 0;
  let offsetY = 0;
  const tokensToCreate = [] as any[];
  const tokensToMove = [] as any[];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const actor = game.actors?.get(m.id);
    if (!actor) continue;

    // Check if token already exists on canvas
    const existingToken = canvas.tokens.placeables.find(
      (token: any) => token.document.actorId === actor.id
    );

    const newX = data.x + offsetX;
    const newY = data.y + offsetY;

    if (existingToken) {
      // Move existing token
      tokensToMove.push({
        _id: existingToken.document.id,
        x: newX,
        y: newY,
      });
    } else {
      // Create new token
      const doc = await actor.getTokenDocument({
        x: newX,
        y: newY,
      });
      tokensToCreate.push(doc.toObject());
    }

    offsetX += grid;
    if ((i + 1) % 5 === 0) {
      offsetX = 0;
      offsetY += grid;
    }
  }

  // Execute operations
  if (tokensToMove.length) {
    // Move tokens individually by updating their documents
    for (const tokenUpdate of tokensToMove) {
      const token = canvas.tokens.get(tokenUpdate._id);
      if (token) {
        // Update token document position directly
        await token.document.update({
          x: tokenUpdate.x,
          y: tokenUpdate.y,
        });
      }
    }
  }

  if (tokensToCreate.length) {
    await canvas.scene?.createEmbeddedDocuments("Token", tokensToCreate);
  }

  return false;
});

// API for debugging purposes
if (typeof globalThis !== "undefined") {
  globalThis.CrowNest = {
    patrol: PatrolSheetManager.getInstance(),
    testSyncCommunication: () => {
      console.log("🧪 Testing sync communication...");
      console.log("Current user:", game.user?.name, "isGM:", game.user?.isGM);

      // Test basic socket
      if (game.socket) {
        const testData = {
          test: "manual test",
          timestamp: Date.now(),
          from: game.user?.name,
          isGM: game.user?.isGM,
        };

        console.log("Sending test data:", testData);
        game.socket.emit(`module.${MODULE_ID}-test`, testData);

        // Also test the main channel
        const syncEvent = {
          type: "patrol-sheet",
          action: "show",
          data: { test: "patrol sheet communication test" },
          timestamp: Date.now(),
          user: game.user?.name ?? "unknown",
        };

        console.log("Sending sync event:", syncEvent);
        game.socket.emit(`module.${MODULE_ID}`, syncEvent);
      }
    },
    testShowPatrolToAll: () => {
      console.log("🧪 Testing show patrol to all...");
      const patrol = PatrolSheetManager.getInstance();
      if (patrol.currentGroup) {
        console.log("Current group:", patrol.currentGroup);
        patrol.showPatrolSheetToAll(patrol.currentGroup);
      } else {
        console.log("No current group available");
      }
    },
    forceShowPatrol: (groupData: any) => {
      console.log("🧪 Force showing patrol:", groupData);
      const syncManager = SyncManager.getInstance();
      const event = {
        type: "patrol-sheet" as const,
        action: "show" as const,
        data: groupData,
        timestamp: Date.now(),
        user: game.user?.name ?? "unknown",
      };
      syncManager.broadcast(event);
    },
    checkSocketStatus: () => {
      console.log("🔍 Socket Status Check:");
      console.log("Socket exists:", !!game.socket);
      console.log("Socket connected:", game.socket?.connected);
      console.log("Socket ID:", game.socket?.id);
      console.log("User:", game.user?.name, "ID:", game.user?.id);
      console.log("Is GM:", game.user?.isGM);
      console.log(
        "Connected users:",
        game.users?.contents?.map((u) => ({
          name: u.name,
          id: u.id,
          active: u.active,
          role: u.role,
          isGM: u.isGM,
        }))
      );
    },
    simulatePlayerReceive: () => {
      console.log("🎭 Simulating player receive...");
      const fakePatrolData = {
        id: "test-patrol-123",
        name: "Test Patrol",
        officer: { name: "Test Officer", img: "icons/svg/mystery-man.svg" },
        soldiers: [],
        mods: {},
      };

      // Directly call the handler as if received from socket
      const patrol = PatrolSheetManager.getInstance();
      patrol.handleShowPatrolSheet(fakePatrolData);
    },
  };
}
