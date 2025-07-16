<script lang="ts">
  import type { GuardModifier, GuardStat } from '@/guard/stats';
  import type { Group } from '@/shared/group';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';

  export let isOpen = false;
  export let stat: GuardStat | null = null;
  export let group: Group | null = null;
  export let baseValue = 0;
  export let totalModifier = 0;
  export let guardModifiers: GuardModifier[] = [];

  const dispatch = createEventDispatcher();

  let popupElement: HTMLElement;
  let hopeDie = 'd12';
  let fearDie = 'd12';
  let hasAdvantage = false;
  let hasDisadvantage = false;
  let advantageDie = 'd4';
  let situationalBonus = '';
  let selectedExperiences: Set<string> = new Set();

  // Position state
  let position = { x: 100, y: 100 };
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // Access Foundry globals
  const game = (globalThis as any).game;
  const Roll = (globalThis as any).Roll;
  const ChatMessage = (globalThis as any).ChatMessage;

  function toggleAdvantage() {
    if (hasAdvantage) {
      hasAdvantage = false;
    } else {
      hasAdvantage = true;
      hasDisadvantage = false;
    }
  }

  function toggleDisadvantage() {
    if (hasDisadvantage) {
      hasDisadvantage = false;
    } else {
      hasDisadvantage = true;
      hasAdvantage = false;
    }
  }

  function toggleExperience(expName: string) {
    if (selectedExperiences.has(expName)) {
      selectedExperiences.delete(expName);
    } else {
      selectedExperiences.add(expName);
    }
    selectedExperiences = new Set(selectedExperiences); // Trigger reactivity
  }

  function close() {
    isOpen = false;
    dispatch('close');
  }

  // Drag functionality
  function startDrag(event: MouseEvent) {
    if ((event.target as HTMLElement).closest('.close-button, .roll-button, select, input, button')) {
      return; // Don't drag if clicking on interactive elements
    }

    isDragging = true;
    dragOffset.x = event.clientX - position.x;
    dragOffset.y = event.clientY - position.y;
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    event.preventDefault();
  }

  function handleDrag(event: MouseEvent) {
    if (isDragging) {
      position.x = event.clientX - dragOffset.x;
      position.y = event.clientY - dragOffset.y;

      // Keep within viewport bounds
      const rect = popupElement?.getBoundingClientRect();
      if (rect) {
        position.x = Math.max(0, Math.min(window.innerWidth - rect.width, position.x));
        position.y = Math.max(0, Math.min(window.innerHeight - rect.height, position.y));
      }
    }
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  async function rollDice() {
    if (!stat || !group) return;

    // Roll the dice individually to get separate results
    const hopeRoll = new Roll(`1${hopeDie}`);
    const fearRoll = new Roll(`1${fearDie}`);

    await hopeRoll.evaluate();
    await fearRoll.evaluate();

    // Safe access to dice results with fallbacks
    let hopeResult = 0;
    let fearResult = 0;

    // Try to get the result from _total first (this is where Foundry stores the actual result)
    if ((hopeRoll as any)._total !== undefined) {
      hopeResult = (hopeRoll as any)._total;
    } else if (hopeRoll.terms && hopeRoll.terms[0] && hopeRoll.terms[0].results && hopeRoll.terms[0].results[0]) {
      hopeResult = hopeRoll.terms[0].results[0].result;
    } else if (hopeRoll.total !== undefined) {
      hopeResult = hopeRoll.total;
    }

    if ((fearRoll as any)._total !== undefined) {
      fearResult = (fearRoll as any)._total;
    } else if (fearRoll.terms && fearRoll.terms[0] && fearRoll.terms[0].results && fearRoll.terms[0].results[0]) {
      fearResult = fearRoll.terms[0].results[0].result;
    } else if (fearRoll.total !== undefined) {
      fearResult = fearRoll.total;
    }

    // Add base stat value and modifiers
    const baseTotal = baseValue + totalModifier;

    // Add advantage/disadvantage
    let advantageResult = 0;
    if (hasAdvantage || hasDisadvantage) {
      const advantageRoll = new Roll(`1${advantageDie}`);
      await advantageRoll.evaluate();
      advantageResult = advantageRoll.total;
    }

    // Add situational bonus
    const bonus = parseInt(situationalBonus) || 0;

    // Calculate final total
    let finalTotal = hopeResult + fearResult + baseTotal + bonus;
    if (hasAdvantage) {
      finalTotal += advantageResult;
    } else if (hasDisadvantage) {
      finalTotal -= advantageResult;
    }

    // Determine which die won
    const hopeWins = hopeResult > fearResult;
    const fearWins = fearResult > hopeResult;
    const tie = hopeResult === fearResult;

    // Build modifiers display
    const modifiers = [];
    if (baseTotal !== 0) {
      modifiers.push(`${stat.name} ${baseTotal >= 0 ? '+' : ''}${baseTotal}`);
    }
    if (hasAdvantage) {
      modifiers.push(`Advantage +${advantageResult}`);
    } else if (hasDisadvantage) {
      modifiers.push(`Disadvantage -${advantageResult}`);
    }
    if (bonus !== 0) {
      modifiers.push(`Situational ${bonus >= 0 ? '+' : ''}${bonus}`);
    }

    // Build experiences display
    const selectedExpArray = Array.from(selectedExperiences);

    // Calculate individual modifiers for display
    const guardStatModifiers = guardModifiers.filter(mod => mod.mods[stat.key] && mod.mods[stat.key] !== 0);
    const patrolModifier = group.mods[stat.key] || 0;

    const groupName = group.name || (group.officer ? `Patrol of ${group.officer.name}` : 'Patrol');

    // Create unique ID for this roll to identify buttons
    const rollId = `roll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Updated HTML with proper Daggerheart classes and action buttons
    const content = `
<div class="crow-nest-roll" data-roll-id="${rollId}" data-group-id="${group.id}" data-hope-wins="${hopeWins}" data-fear-wins="${fearWins}" data-tie="${tie}">
  <div class="message-content">
    <div class="dice-roll daggerheart chat roll" data-action="expandRoll">
      <div class="dice-flavor">Duality Roll: ${groupName}</div>
      <div class="dice-roll-type">${stat.name} Check</div>
    ${modifiers.length > 0 ? `
    <div class="duality-modifiers">
      ${modifiers.map(mod => `<div class="duality-modifier">${mod}</div>`).join('')}
    </div>` : ''}
    ${selectedExpArray.length > 0 ? `
    <div class="duality-modifiers">
      <div class="duality-modifier">Experiences: ${selectedExpArray.join(', ')}</div>
    </div>` : ''}
    <div class="dice-result">
      <div class="dice-formula">${hopeDie} + ${fearDie}${baseTotal !== 0 ? ` ${baseTotal >= 0 ? '+' : ''}${baseTotal}` : ''}${hasAdvantage ? ` +${advantageDie}` : ''}${hasDisadvantage ? ` -${advantageDie}` : ''}${bonus !== 0 ? ` ${bonus >= 0 ? '+' : ''}${bonus}` : ''}</div>
      <div class="dice-tooltip">
        <div class="wrapper">
          <section class="tooltip-part">
            <div class="dice">
              <header class="part-header flexrow">
                <span class="part-formula">
                  <span>${hopeDie}</span>
                  |
                  <span>${fearDie}</span>
                </span>
                <span class="part-total">${hopeResult + fearResult}</span>
              </header>
              <div class="flexrow">
                <ol class="dice-rolls duality">
                  <li class="roll die ${hopeDie.substr(1)}" title="Hope">
                    <div class="dice-container">
                      <div class="dice-title">Hope</div>
                      <div class="dice-inner-container hope" title="Hope">
                        <div class="dice-wrapper">
                          <img class="dice" src="systems/daggerheart/assets/icons/dice/hope/${hopeDie}.svg">
                        </div>
                        <div class="dice-value">${hopeResult}</div>
                      </div>
                    </div>
                  </li>
                  <li class="roll die ${fearDie.substr(1)}" title="Fear">
                    <div class="dice-container">
                      <div class="dice-title">Fear</div>
                      <div class="dice-inner-container fear" title="Fear">
                        <div class="dice-wrapper">
                          <img class="dice" src="systems/daggerheart/assets/icons/dice/fear/${fearDie}.svg">
                        </div>
                        <div class="dice-value">${fearResult}</div>
                      </div>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div class="dice-total duality ${hopeWins ? 'hope' : fearWins ? 'fear' : 'critical'}">
        <div class="dice-total-label">${hopeWins ? 'Hope' : fearWins ? 'Fear' : 'Critical Success'}</div>
        <div class="dice-total-value">${finalTotal}</div>
      </div>
      ${baseValue !== 0 || guardStatModifiers.length > 0 || patrolModifier !== 0 || bonus !== 0 || (hasAdvantage || hasDisadvantage) ? `
      <div class="total-bonuses">
        <div class="bonuses-title">Bonuses Breakdown:</div>
        <div class="bonuses-breakdown">
          ${baseValue !== 0 ? `<span class="bonus-item">Guard ${stat.name} Base: ${baseValue >= 0 ? '+' : ''}${baseValue}</span>` : ''}
          ${guardStatModifiers.map(mod => `<span class="bonus-item">${mod.name}: ${mod.mods[stat.key] >= 0 ? '+' : ''}${mod.mods[stat.key]}</span>`).join('')}
          ${patrolModifier !== 0 ? `<span class="bonus-item">Patrol Modifier: ${patrolModifier >= 0 ? '+' : ''}${patrolModifier}</span>` : ''}
          ${bonus !== 0 ? `<span class="bonus-item">Situational: ${bonus >= 0 ? '+' : ''}${bonus}</span>` : ''}
          ${hasAdvantage ? `<span class="bonus-item">Advantage: +${advantageResult}</span>` : ''}
          ${hasDisadvantage ? `<span class="bonus-item">Disadvantage: -${advantageResult}</span>` : ''}
        </div>
      </div>` : ''}
    </div>
  </div>
  <div class="dice-roll daggerheart chat roll">
    <div class="dice-result">
      <div class="dice-actions duality-alone">
        <div class="duality-result">
          <div>${finalTotal} ${hopeWins ? 'With Hope' : fearWins ? 'With Fear' : 'Critical Success - Tie'}</div>
        </div>
        <div class="roll-action-buttons">
          ${hopeWins || tie ? `<button class="roll-action-btn hope-btn" data-action="add-hope" data-roll-id="${rollId}">
            <i class="fas fa-plus"></i> Add Hope to Patrol
          </button>` : ''}
          ${fearWins ? `<button class="roll-action-btn fear-btn" data-action="add-fear" data-roll-id="${rollId}">
            <i class="fas fa-skull"></i> Add Fear to System
          </button>` : ''}
        </div>
      </div>
    </div>
  </div>
</div>`;

    // Send to chat
    ChatMessage.create({
      speaker: { alias: groupName },
      content: content
    });

    close();
  }

  // Close on Escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      close();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);

    // Load saved position
    const savedPosition = localStorage.getItem('crow-nest-roll-dialog-position');
    if (savedPosition) {
      try {
        position = JSON.parse(savedPosition);
      } catch (e) {
        // Use default position if parsing fails
      }
    }
  });

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
    stopDrag();

    // Save position
    localStorage.setItem('crow-nest-roll-dialog-position', JSON.stringify(position));
  });

  // Reset experiences when group changes
  $: if (group) {
    selectedExperiences.clear();
    selectedExperiences = new Set();
  }
</script>

{#if isOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="roll-dialog-popup"
    bind:this={popupElement}
    style="left: {position.x}px; top: {position.y}px; cursor: {isDragging ? 'grabbing' : 'grab'}"
    on:mousedown={startDrag}
  >
    <header class="dialog-header">
      <h1>{stat?.name || 'Unknown'} Check</h1>
      <button class="close-button" on:click={close} type="button">×</button>
    </header>

    <div class="dialog-content">
      <!-- Dice Selection -->
      <div class="dices-section">
        <div class="dice-option">
          <img class="dice-icon" src="systems/daggerheart/assets/icons/dice/hope/d12.svg" alt="Hope Die" />
          <div class="dice-select">
            <span class="label">Hope</span>
            <select bind:value={hopeDie}>
              <option value="d4">d4</option>
              <option value="d6">d6</option>
              <option value="d8">d8</option>
              <option value="d10">d10</option>
              <option value="d12" selected>d12</option>
              <option value="d20">d20</option>
            </select>
          </div>
        </div>

        <div class="dice-option">
          <img class="dice-icon" src="systems/daggerheart/assets/icons/dice/fear/d12.svg" alt="Fear Die" />
          <div class="dice-select">
            <span class="label">Fear</span>
            <select bind:value={fearDie}>
              <option value="d4">d4</option>
              <option value="d6">d6</option>
              <option value="d8">d8</option>
              <option value="d10">d10</option>
              <option value="d12" selected>d12</option>
              <option value="d20">d20</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Experiences Section -->
      {#if group?.experiences && group.experiences.length > 0}
        <fieldset class="experience-container">
          <legend>Experiences</legend>
          <div class="experiences-list">
            {#each group.experiences as exp}
              <button
                class="experience-chip {selectedExperiences.has(exp.name) ? 'selected' : ''}"
                on:click={() => toggleExperience(exp.name)}
                type="button"
              >
                <span><i class="fa-regular {selectedExperiences.has(exp.name) ? 'fa-circle-check' : 'fa-circle'}"></i></span>
                <span class="label">{exp.name}</span>
              </button>
            {/each}
          </div>
        </fieldset>
      {/if}

      <!-- Modifiers Section -->
      <fieldset class="modifier-container">
        <legend>Modifiers</legend>
        <div class="nest-inputs">
          <button
            class="advantage-chip flex1 {hasAdvantage ? 'selected' : ''}"
            on:click={toggleAdvantage}
            type="button"
          >
            <span><i class="fa-regular {hasAdvantage ? 'fa-circle-check' : 'fa-circle'}"></i></span>
            <span class="label">Advantage</span>
          </button>

          <button
            class="disadvantage-chip flex1 {hasDisadvantage ? 'selected' : ''}"
            on:click={toggleDisadvantage}
            type="button"
          >
            <span><i class="fa-regular {hasDisadvantage ? 'fa-circle-check' : 'fa-circle'}"></i></span>
            <span class="label">Disadvantage</span>
          </button>

          <select bind:value={advantageDie} disabled={!hasAdvantage && !hasDisadvantage}>
            <option value="d4">d4</option>
            <option value="d6">d6</option>
            <option value="d8">d8</option>
            <option value="d10">d10</option>
            <option value="d12">d12</option>
            <option value="d20">d20</option>
          </select>
        </div>

        <input
          type="text"
          bind:value={situationalBonus}
          placeholder="Situational Bonus"
        />
      </fieldset>

      <!-- Roll Button -->
      <div class="roll-button-container">
        <button class="roll-button" on:click={rollDice} type="button">
          <i class="fas fa-dice-d20"></i>
          Roll {stat?.name || 'Check'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .roll-dialog-popup {
    position: fixed;
    background: var(--color-bg, #2a2a2a);
    border: 2px solid var(--color-border-dark, #666);
    border-radius: 8px;
    min-width: 400px;
    max-width: 500px;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    user-select: none;
  }

  .dialog-header {
    background: var(--color-bg-header, #1a1a1a);
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border-dark, #666);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 6px 6px 0 0;
  }

  .dialog-header h1 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--color-text-primary, #fff);
    font-weight: bold;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1rem;
    color: var(--color-text-primary, #fff);
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
    flex: 0 1 24px;
    line-height: 0;
    position: static;
  }

  .close-button:hover {
    background-color: rgba(255, 107, 107, 0.2);
    color: #ff6b6b;
  }

  .dialog-content {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .dices-section {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .dice-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .dice-icon {
    width: 48px;
    height: 48px;
  }

  .dice-select {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .dice-select .label {
    font-weight: bold;
    color: var(--color-text-primary, #fff);
    font-size: 0.9rem;
  }

  .dice-select select {
    padding: 0.25rem;
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    background: var(--color-bg-input, #3a3a3a);
    color: var(--color-text-primary, #fff);
    cursor: pointer;
  }

  .experience-container, .modifier-container {
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    padding: 0.75rem;
    margin: 0;
  }

  .experience-container legend, .modifier-container legend {
    color: var(--color-text-primary, #fff);
    font-weight: bold;
    padding: 0 0.5rem;
    font-size: 0.9rem;
  }

  .experiences-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .experience-chip, .advantage-chip, .disadvantage-chip {
    background: var(--color-bg-button, #4a4a4a);
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
    color: var(--color-text-primary, #fff);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.2s ease;
    font-size: 0.85rem;
  }

  .experience-chip:hover, .advantage-chip:hover, .disadvantage-chip:hover {
    background: var(--color-bg-button-hover, #5a5a5a);
  }

  .experience-chip.selected, .advantage-chip.selected {
    background: var(--color-bg-success, #28a745);
    border-color: var(--color-border-success, #1e7e34);
  }

  .disadvantage-chip.selected {
    background: var(--color-bg-danger, #dc3545);
    border-color: var(--color-border-danger, #bd2130);
  }

  .nest-inputs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    align-items: center;
  }

  .flex1 {
    flex: 1;
  }

  .nest-inputs select {
    min-width: 80px;
    padding: 0.4rem;
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    background: var(--color-bg-input, #3a3a3a);
    color: var(--color-text-primary, #fff);
    cursor: pointer;
  }

  .nest-inputs select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modifier-container input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    background: var(--color-bg-input, #3a3a3a);
    color: var(--color-text-primary, #fff);
  }

  .modifier-container input::placeholder {
    color: var(--color-text-muted, #999);
  }

  .roll-button-container {
    display: flex;
    justify-content: center;
    margin-top: 0.5rem;
  }

  .roll-button {
    background: var(--color-bg-primary, #007bff);
    border: none;
    border-radius: 6px;
    padding: 0.75rem 1.5rem;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s ease;
  }

  .roll-button:hover {
    background: var(--color-bg-primary-hover, #0056b3);
    transform: translateY(-1px);
  }

  .roll-button:active {
    transform: translateY(0);
  }

  /* Chat Message Daggerheart Styles - Scoped to our component only */
  :global(.crow-nest-roll .dice-roll.daggerheart) {
    border: 1px solid var(--color-border-dark, #666);
    border-radius: 4px;
    margin: 0.25rem 0;
  }

  :global(.crow-nest-roll .dice-roll-type) {
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.1);
    font-size: 0.9em;
    font-weight: bold;
    color: var(--color-text-secondary, #888);
    border-bottom: 1px solid var(--color-border-light, #ddd);
  }

  :global(.crow-nest-roll .duality-modifiers) {
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.1);
  }

  :global(.crow-nest-roll .duality-modifier) {
    font-size: 0.9em;
    color: var(--color-text-secondary, #ccc);
  }

  :global(.crow-nest-roll .dice-result) {
    padding: 0.5rem;
  }

  :global(.crow-nest-roll .dice-formula) {
    font-family: monospace;
    color: #000000;
    margin-bottom: 0.25rem;
  }

  :global(.crow-nest-roll .dice-rolls.duality) {
    display: flex;
    gap: 1rem;
    list-style: none;
    padding: 0;
    margin: 0.5rem 0;
  }

  :global(.crow-nest-roll .dice-container) {
    text-align: center;
  }

  :global(.crow-nest-roll .dice-title) {
    font-size: 0.8em;
    font-weight: bold;
    margin-bottom: 0.25rem;
  }

  :global(.crow-nest-roll .dice-inner-container.hope) {
    color: #28a745;
  }

  :global(.crow-nest-roll .dice-inner-container.fear) {
    color: #dc3545;
  }

  :global(.crow-nest-roll .dice-wrapper img) {
    width: 32px;
    height: 32px;
  }

  :global(.crow-nest-roll .dice-value) {
    font-weight: bold;
    font-size: 1.2em;
    margin-top: 0.25rem;
  }

  :global(.crow-nest-roll .dice-total.duality) {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-radius: 4px;
    font-weight: bold;
  }

  :global(.crow-nest-roll .duality-result) {
    text-align: center;
    font-weight: bold;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
    margin-top: 0.25rem;
  }

  :global(.crow-nest-roll .total-bonuses) {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
    border-top: 1px solid var(--color-border-light, #ddd);
  }

  :global(.crow-nest-roll .bonuses-title) {
    font-weight: bold;
    font-size: 0.9em;
    color: var(--color-text-secondary, #666);
    margin-bottom: 0.25rem;
  }

  :global(.crow-nest-roll .bonuses-breakdown) {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  :global(.crow-nest-roll .bonus-item) {
    background: rgba(0, 0, 0, 0.1);
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.85em;
    color: var(--color-text-primary, #333);
  }

  :global(.crow-nest-roll .roll-action-buttons) {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.5rem;
  }

  :global(.crow-nest-roll .roll-action-btn) {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 4px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  :global(.crow-nest-roll .hope-btn) {
    background: #28a745;
    color: white;
  }

  :global(.crow-nest-roll .hope-btn:hover) {
    background: #218838;
    transform: translateY(-1px);
  }

  :global(.crow-nest-roll .fear-btn) {
    background: #dc3545;
    color: white;
  }

  :global(.crow-nest-roll .fear-btn:hover) {
    background: #c82333;
    transform: translateY(-1px);
  }

  :global(.crow-nest-roll .roll-action-btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
</style>
