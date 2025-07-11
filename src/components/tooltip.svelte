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
    tooltipEl.style.maxWidth = `${popup.width - 8}px`;

    const tip = tooltipEl.getBoundingClientRect();
    let desiredLeft = center - tip.width / 2;
    desiredLeft = Math.min(
      Math.max(desiredLeft, 0),
      popup.width - tip.width
    );
    const left = desiredLeft;

    let top = wrap.top - popup.top - tip.height - 4;
    if (wrap.top + top < popup.top) {
      top = wrap.top - popup.top + wrap.height + 4;
    }
    if (wrap.top + top + tip.height > popup.bottom) {
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

<div class="tooltip-wrapper" bind:this={wrapperEl} on:mouseenter={onEnter} on:mouseleave={onLeave}>
  <slot></slot>
  {#if show}
    <div class="tooltip" bind:this={tooltipEl}>
      {@html content}
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-block;
  }
  .tooltip {
    position: absolute;
    background: #333;
    color: white;
    padding: 0.25rem;
    border-radius: 4px;
    white-space: normal;
    word-wrap: break-word;
    z-index: 10;
    pointer-events: none;
  }
</style>
