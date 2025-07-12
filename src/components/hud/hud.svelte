<script lang="ts">
  import Guard from "@/components/guard/guard.svelte";
  import { MODULE_ID } from '@/constants';
  import { adjustCheers, adjustDespair, getTokens, isGM, type GameTokens } from '@/data/tokens';
  import { SyncManager, type SyncEvent } from '@/utils/sync';
  import { onDestroy, onMount } from "svelte";

  let pos = { x: 0, y: 0 };
  let isDragging = false;
  let offset = { x: 0, y: 0 };
  let showPopup = false;

  // Game tokens
  let gameTokens: GameTokens = { despair: 0, cheers: 0 };

  // Sync manager
  let syncManager: SyncManager;

  onMount(() => {
    const saved = localStorage.getItem("crowHudPos");
    if (saved) {
      pos = JSON.parse(saved);
    } else {
      pos = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      };
    }

    // Load game tokens
    gameTokens = getTokens();

    // Setup real-time synchronization
    console.log("🔌 HUD: Setting up sync manager");
    syncManager = SyncManager.getInstance();

    // Listen for token updates
    console.log("👂 HUD: Subscribing to tokens events");
    syncManager.subscribe('tokens', handleTokenSync);
    // Listen for all sync events to refresh UI
    console.log("👂 HUD: Subscribing to all events");
    syncManager.subscribe('all', handleAllSync);

    console.log("✅ HUD: Sync setup complete");

    // Also listen for direct game settings changes as backup
    console.log("👂 HUD: Setting up game settings listener");
    Hooks.on('updateSetting', (setting: any) => {
      console.log("⚙️ HUD: Game setting changed", setting.key, setting.value);
      if (setting.key === `${MODULE_ID}.gameTokens`) {
        console.log("🎯 HUD: Game tokens setting changed, updating UI");
        gameTokens = setting.value;
      }
    });
  });

  onDestroy(() => {
    console.log("🧹 HUD: Cleaning up sync subscriptions");
    if (syncManager) {
      syncManager.unsubscribe('tokens', handleTokenSync);
      syncManager.unsubscribe('all', handleAllSync);
    }
  });

  // Handle token synchronization events
  function handleTokenSync(event: SyncEvent) {
    console.log("🎯 HUD: Token sync event received", event);
    if (event.type === 'tokens') {
      gameTokens = event.data;
      console.log("🔄 HUD: Updated gameTokens", gameTokens);
    }
  }

  // Handle all synchronization events for general UI refresh
  function handleAllSync(event: SyncEvent) {
    console.log("📡 HUD: General sync event received", event.type, event.action);
    // This can be used to trigger general UI updates
    // For now, we'll just handle specific cases
  }

  function onMouseDown(event: MouseEvent) {
    isDragging = true;
    offset = {
      x: event.clientX - pos.x,
      y: event.clientY - pos.y,
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(event: MouseEvent) {
    if (!isDragging) return;
    pos = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  }

  function onMouseUp() {
    isDragging = false;
    localStorage.setItem("crowHudPos", JSON.stringify(pos));
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  function togglePopup() {
    showPopup = !showPopup;
  }

  // Game tokens functions
  async function increaseDespair() {
    console.log("🔺 HUD: Increasing despair");
    await adjustDespair(1);
    gameTokens = getTokens();
    console.log("📊 HUD: New tokens after increase", gameTokens);
  }

  async function decreaseDespair() {
    console.log("🔻 HUD: Decreasing despair");
    await adjustDespair(-1);
    gameTokens = getTokens();
    console.log("📊 HUD: New tokens after decrease", gameTokens);
  }

  async function increaseCheers() {
    console.log("🔺 HUD: Increasing cheers");
    await adjustCheers(1);
    gameTokens = getTokens();
    console.log("📊 HUD: New tokens after increase", gameTokens);
  }

  async function decreaseCheers() {
    console.log("🔻 HUD: Decreasing cheers");
    await adjustCheers(-1);
    gameTokens = getTokens();
    console.log("📊 HUD: New tokens after decrease", gameTokens);
  }
</script>

<style>
  .hud-crow {
    position: absolute;
    top: 0;
    left: 0;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    padding: 0.5rem;
    border-radius: 0.5rem;
    user-select: none;
    z-index: 1000;
    width: max-content;
  }

  .hud-crow.expanded {
    background: rgba(0, 0, 0, 1);
  }

  .drag-area {
    cursor: move;
    margin-bottom: 0.25rem;
  }

  /* Game Tokens in HUD */
  .hud-tokens {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .hud-token-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .hud-token-label {
    font-size: 0.7rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hud-token-value {
    font-size: 1.2rem;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .hud-token-controls {
    display: flex;
    gap: 0.25rem;
  }

  .hud-token-button {
    width: 20px;
    height: 20px;
    border: 1px solid #d4af37;
    background: rgba(139, 105, 20, 0.9);
    color: #f4f1e8;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .hud-token-button:hover {
    background: rgba(212, 175, 55, 0.9);
    color: #1a0f08;
    transform: scale(1.1);
  }

  .hud-token-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .despair-token {
    color: #ff6b6b;
  }

  .cheers-token {
    color: #51cf66;
  }
</style>

<div
  class="hud-crow"
  class:expanded={showPopup}
  style="transform: translate({pos.x}px, {pos.y}px);"
>
  <div class="drag-area" role="button" tabindex="0" on:mousedown={onMouseDown} on:keydown={(e) => e.key === 'Enter' && onMouseDown(e)}>Crow Nest</div>
  <button on:click|stopPropagation={togglePopup}>Abrir Popup</button>

  <!-- Game Tokens (Visible to all, buttons only for GM) -->
  <div class="hud-tokens">
    <div class="hud-token-group">
      <div class="hud-token-label despair-token">Despair</div>
      <div class="hud-token-value despair-token">{gameTokens.despair}</div>
      {#if isGM()}
        <div class="hud-token-controls">
          <button class="hud-token-button" on:click|stopPropagation={decreaseDespair} disabled={gameTokens.despair <= 0}>
            −
          </button>
          <button class="hud-token-button" on:click|stopPropagation={increaseDespair}>
            +
          </button>
        </div>
      {/if}
    </div>

    <div class="hud-token-group">
      <div class="hud-token-label cheers-token">Cheers</div>
      <div class="hud-token-value cheers-token">{gameTokens.cheers}</div>
      {#if isGM()}
        <div class="hud-token-controls">
          <button class="hud-token-button" on:click|stopPropagation={decreaseCheers} disabled={gameTokens.cheers <= 0}>
            −
          </button>
          <button class="hud-token-button" on:click|stopPropagation={increaseCheers}>
            +
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>

<Guard {showPopup} on:close={togglePopup} />
