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
    syncManager = SyncManager.getInstance();

    // Listen for token updates
    syncManager.subscribe('tokens', handleTokenSync);
    // Listen for all sync events to refresh UI
    syncManager.subscribe('all', handleAllSync);


    // Also listen for direct game settings changes as backup
    Hooks.on('updateSetting', (setting: any) => {
      if (setting.key === `${MODULE_ID}.gameTokens`) {
        gameTokens = setting.value;
      }
    });
  });

  onDestroy(() => {
    if (syncManager) {
      syncManager.unsubscribe('tokens', handleTokenSync);
      syncManager.unsubscribe('all', handleAllSync);
    }
  });

  // Handle token synchronization events
  function handleTokenSync(event: SyncEvent) {
    if (event.type === 'tokens') {
      gameTokens = event.data;
    }
  }

  // Handle all synchronization events for general UI refresh
  function handleAllSync(event: SyncEvent) {
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
    await adjustDespair(1);
    gameTokens = getTokens();
  }

  async function decreaseDespair() {
    await adjustDespair(-1);
    gameTokens = getTokens();
  }

  async function increaseCheers() {
    await adjustCheers(1);
    gameTokens = getTokens();
  }

  async function decreaseCheers() {
    await adjustCheers(-1);
    gameTokens = getTokens();
  }
</script>

<style>
  .hud-crow {
    border: 2px solid #d4af37;
    position: absolute;
    top: 0;
    left: 0;
    background: #ffffff;
    color: white;
    border-radius: 0.5rem;
    user-select: none;
    z-index: 50;
    width: 200px;
  }

  .drag-area {
    cursor: move;
    margin-bottom: 0.25rem;
    height: 1rem;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 5;
  }

  /* Header Image */
  .hud-header-image {
    width: 100%;
    height: 60px;
    background-image: url('modules/crow-nest/static/img/hud-banner.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    border-bottom: 2px solid #d4af37;
    border-radius: 0.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.9);
    transition: all 0.2s ease;
    color: white;
    position: relative;
  }

  .hud-header-image::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 0.25rem;
    transition: all 0.2s ease;
  }

  .hud-header-image span {
    position: relative;
    z-index: 1;
    font-family: "Overpass", Arial, sans-serif;
  }

  /* Game Tokens in HUD */
  .hud-tokens {
    display: flex;
    gap: 0.5rem;
    padding: 0.5rem;
    justify-content: space-around;
  }

  .hud-token-group {
    background: #000000;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    border: solid 2px #ff6b6b;
    padding: .5rem;
    border-radius: .25rem;
    min-width: 80px;
  }

  .hud-token-group.cheers {
    border: solid 2px #51cf66;
  }

  .hud-token-label {
    font-family: "Overpass", Arial, sans-serif;
    font-size: 0.7rem;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .hud-token-value {
    font-family: "Eveleth Dot", "Eveleth", "Overpass", Arial, sans-serif;
    font-size: 1.2rem;
    font-weight: bold;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
  }

  .hud-token-controls {
    display: flex;
    gap: 0.25rem;
  }

  .hud-token-button {
font-size: .8rem;
    padding: .4rem .8rem;
    border-radius: 4px;
    border: 1px solid #d4af37;
    background: #000;
    color: #f9fafb;
    cursor: pointer;
    transition: all .2s ease;
    display: flex
;
    align-items: center;
    gap: .3rem;
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
  <div class="drag-area" role="button" tabindex="0" on:mousedown={onMouseDown} on:keydown={(e) => e.key === 'Enter' && onMouseDown(e)}></div>

  <!-- Header Image that opens popup when clicked -->
  <div class="hud-header-image" on:click|stopPropagation={togglePopup} on:keydown={(e) => e.key === 'Enter' && togglePopup()} role="button" tabindex="0">
    <span>Crow's Nest</span>
  </div>

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
