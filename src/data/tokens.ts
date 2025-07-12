// Token management for GM-only tokens like Despair and Cheers
// These are stored in Foundry's game settings, not localStorage

import { MODULE_ID } from "@/constants";
import { SyncManager, createSyncEvent } from "@/utils/sync";

export interface GameTokens {
  despair: number;
  cheers: number;
}

const TOKENS_SETTING = "crow-nest.game-tokens";

export function getTokens(): GameTokens {
  const tokens = game.settings?.get(MODULE_ID, "gameTokens") as GameTokens;
  return tokens || { despair: 0, cheers: 0 };
}

export async function saveTokens(tokens: GameTokens): Promise<void> {
  if (game.settings && game.user?.isGM) {
    console.log("💾 Tokens: Saving tokens as GM", tokens);
    await game.settings.set(MODULE_ID, "gameTokens", tokens);

    // Broadcast change to all players
    const syncManager = SyncManager.getInstance();
    await syncManager.broadcast(createSyncEvent("tokens", "update", tokens));
  } else if (!game.user?.isGM) {
    console.log("🚫 Tokens: Skipping save - not GM");
  }
}

export async function adjustDespair(delta: number): Promise<void> {
  if (!game.user?.isGM) {
    console.log("🚫 Tokens: Only GM can adjust despair");
    return;
  }

  const tokens = getTokens();
  tokens.despair = Math.max(0, tokens.despair + delta);
  await saveTokens(tokens);
}

export async function adjustCheers(delta: number): Promise<void> {
  if (!game.user?.isGM) {
    console.log("🚫 Tokens: Only GM can adjust cheers");
    return;
  }

  const tokens = getTokens();
  tokens.cheers = Math.max(0, tokens.cheers + delta);
  await saveTokens(tokens);
}

export function isGM(): boolean {
  return game.user?.isGM ?? false;
}
