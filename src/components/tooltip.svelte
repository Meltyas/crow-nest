<script lang="ts">
  import { tick } from 'svelte';
  export let content = '';
  let show = false;
  let tooltipEl: HTMLDivElement;
  let wrapperEl: HTMLDivElement;
  let containerEl: HTMLElement | null = null;

  async function position() {
    await tick();
    if (!tooltipEl || !wrapperEl) return;
    containerEl = wrapperEl.closest('.window-app');
    if (!containerEl) containerEl = document.body;
    if (tooltipEl.parentElement !== containerEl) {
      containerEl.appendChild(tooltipEl);
    }
    const wrap = wrapperEl.getBoundingClientRect();
    const popup = containerEl.getBoundingClientRect();

    const center = wrap.left - popup.left + wrap.width / 2;
    const maxWidth = popup.width * 0.5;
    tooltipEl.style.maxWidth = `${maxWidth}px`;

    const tip = tooltipEl.getBoundingClientRect();
    let desiredLeft = center - tip.width / 2;
    desiredLeft = Math.min(
      Math.max(desiredLeft, 0),
      popup.width - tip.width
    );
    const left = desiredLeft;

    let top = wrap.top - popup.top - tip.height - 4;
    if (top < 0) {
      top = wrap.top - popup.top + wrap.height + 4;
    }
    if (top + tip.height > popup.height) {
      top = popup.height - tip.height;
    }

    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function onEnter() {
    show = true;
    position();
  }
  function onLeave() {
    show = false;
  }
</script>

<div class="tooltip-wrapper" role="tooltip" bind:this={wrapperEl} on:mouseenter={onEnter} on:mouseleave={onLeave}>
  <slot></slot>
  <div class="tooltip" bind:this={tooltipEl} style:display={show ? undefined : 'none'}>
    {@html content}
  </div>
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-block;
  }
  .tooltip {
    position: absolute;
    background: rgba(11, 10, 19, 0.95);
    color: #f4f1e8;
    border: 1px solid #d4af37;
    padding: 0.5rem 12px;
    border-radius: 6px;
    white-space: normal;
    word-wrap: break-word;
    z-index: 15000;
    pointer-events: none;
    box-sizing: border-box;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(4px);
    font-family: "Cinzel", serif;
  }
</style>
