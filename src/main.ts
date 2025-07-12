import Hud from "@/components/hud/hud.svelte";
import { patrolSheetManager } from "@/components/patrol-sheet/patrol-sheet";
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
import { initializeSync } from "@/utils/sync";
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
