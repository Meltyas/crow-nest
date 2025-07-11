import Hud from "@/components/hud/hud.svelte";
import OrganizationStatsApp from "@/guard/organization-stats-app";
import {
  MODULE_ID,
  SETTING_STATS,
  SETTING_LOG,
  SETTING_MODIFIERS,
  SETTING_RESOURCES,
  SETTING_PATROLS,
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
