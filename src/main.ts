import Hud from "@/components/hud/hud.svelte";
import OrganizationStatsApp from "@/guard/organization-stats-app";
import { getPatrols } from "@/patrol/patrols";
import {
  MODULE_ID,
  SETTING_STATS,
  SETTING_LOG,
  SETTING_MODIFIERS,
  SETTING_RESOURCES,
  SETTING_PATROLS,
  SETTING_ADMINS,
} from "@/constants";
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
});

Hooks.once("ready", () => {
  console.log("Crow Nest | Ready");
});

Hooks.once("ready", () => {
  const container = document.createElement("div");
  container.style.position = "absolute";
  document.body.appendChild(container);
  new Hud({ target: container });
});

Hooks.on("getActorSheetHeaderButtons", (sheet: any, buttons: any[]) => {
  if (sheet.actor?.type === "npc") {
    buttons.unshift({
      label: "Stats",
      class: "crow-guard-stats",
      icon: "fas fa-shield-alt",
      onclick: () => new OrganizationStatsApp().render(true),
    });
  }
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
  const tokens = [] as any[];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const actor = game.actors?.get(m.id);
    if (!actor) continue;

    const doc = await actor.getTokenDocument({
      x: data.x + offsetX,
      y: data.y + offsetY,
    });
    tokens.push(doc.toObject());

    offsetX += grid;
    if ((i + 1) % 5 === 0) {
      offsetX = 0;
      offsetY += grid;
    }
  }

  if (tokens.length) {
    await canvas.scene?.createEmbeddedDocuments("Token", tokens);
  }

  return false;
});
