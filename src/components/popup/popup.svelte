<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let title = 'Crow Nest Popup';
  const dispatch = createEventDispatcher();

  let pos = { x: 0, y: 0 };
  let dragging = false;
  let offset = { x: 0, y: 0 };
  let size = { width: 800, height: 400 };
  let resizing = false;
  let startResize = { x: 0, y: 0, width: 0, height: 0 };

  onMount(() => {
    pos = { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 100 };
    const saved = localStorage.getItem('crowPopupSize');
    if (saved) size = JSON.parse(saved);
  });

  function onHeaderDown(event: MouseEvent) {
    dragging = true;
    offset = {
      x: event.clientX - pos.x,
      y: event.clientY - pos.y,
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function onMove(event: MouseEvent) {
    if (!dragging) return;
    pos = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
  }

  function onUp() {
    dragging = false;
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }

  function onResizeDown(event: MouseEvent) {
    resizing = true;
    startResize = {
      x: event.clientX,
      y: event.clientY,
      width: size.width,
      height: size.height,
    };
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeUp);
  }

  function onResizeMove(event: MouseEvent) {
    if (!resizing) return;
    size = {
      width: Math.max(200, startResize.width + (event.clientX - startResize.x)),
      height: Math.max(100, startResize.height + (event.clientY - startResize.y)),
    };
  }

  function onResizeUp() {
    resizing = false;
    localStorage.setItem('crowPopupSize', JSON.stringify(size));
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeUp);
  }

  function close() {
    dispatch('close');
  }
</script>

<style>
  .window-app {
    position: absolute;
    background: rgba(11, 10, 19, 0.9);
    color: white;
    border: 1px solid #555;
    border-radius: 4px;
    min-width: 800px;
    box-shadow: rgb(0, 0, 0) 0px 0px 10px 0px;
  }

  .backdrop {
    backdrop-filter: blur(4px);
    border: 0.8px solid rgb(243, 194, 103);
  }

  header {
    background: #444;
    padding: 0.25rem;
    cursor: move;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .close {
    cursor: pointer;
  }

  .content {
    padding: 0.5rem;
  }

  .resizer {
    position: absolute;
    width: 16px;
    height: 16px;
    right: 0;
    bottom: 0;
    cursor: nwse-resize;
    background: rgba(255, 255, 255, 0.3);
  }
</style>

<div
  class="window-app"
  style="transform: translate({pos.x}px, {pos.y}px); width: {size.width}px; height: {size.height}px;"
>
  <header on:mousedown={onHeaderDown}>
    <span>{title}</span>
    <a class="close" on:click={close}>×</a>
  </header>
  <div class="backdrop" style="height: calc(100% - 1.5rem);">
    <div class="content" style="height: 100%; overflow: auto;">
      <slot />
    </div>
  </div>
  <div class="resizer" on:mousedown={onResizeDown}></div>
</div>
