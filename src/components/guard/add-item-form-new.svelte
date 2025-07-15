<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let type: 'reputation' | 'resource';
  export let item: any;
  export let visible = false;

  const dispatch = createEventDispatcher();

  $: config = type === 'reputation' ? {
    imageDefault: 'icons/svg/aura.svg',
    imageClass: 'item-image reputation-type',
    imageButtonClass: 'item-image-button',
    inputClass: 'item-input reputation-type',
    textareaClass: 'item-textarea reputation-type',
    nameClass: 'item-name reputation-type',
    formClass: 'add-item-form reputation-type',
    namePlaceholder: 'Nombre de la facción',
    valuePlaceholder: 'Reputación (0-10)',
    detailsPlaceholder: 'Detalles sobre tu relación con esta facción...',
    valueMin: 0,
    valueMax: 10
  } : {
    imageDefault: 'icons/svg/item-bag.svg',
    imageClass: 'item-image',
    imageButtonClass: 'item-image-button',
    inputClass: 'item-input',
    textareaClass: 'item-textarea',
    nameClass: 'item-name',
    formClass: 'add-item-form',
    namePlaceholder: 'Nombre del recurso',
    valuePlaceholder: 'Cantidad',
    detailsPlaceholder: 'Descripción del recurso...',
    valueMin: 0,
    valueMax: undefined
  };

  function handleImageClick() {
    dispatch('imageClick');
  }

  function handleConfirm() {
    dispatch('confirm');
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

{#if visible}
  <div class={config.formClass}>
    <button type="button" class={config.imageButtonClass} on:click={handleImageClick}>
      <img class={config.imageClass} src={item.img || config.imageDefault} alt={type} />
    </button>
    <input
      class="{config.inputClass} {config.nameClass}"
      placeholder={config.namePlaceholder}
      bind:value={item.name}
    />
    <input
      class="{config.inputClass} number"
      type="number"
      min={config.valueMin}
      max={config.valueMax}
      placeholder={config.valuePlaceholder}
      bind:value={item.value}
    />
    <textarea
      class={config.textareaClass}
      placeholder={config.detailsPlaceholder}
      bind:value={item.details}
    ></textarea>
    <button class="standard-button" on:click={handleConfirm}>Agregar</button>
    <button class="standard-button" on:click={handleCancel}>Cancelar</button>
  </div>
{/if}

<style>
  .add-reputation-form,
  .add-resource-form {
    display: flex;
    font-family: "Overpass", sans-serif;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid #6b7280;
    border-radius: 8px;
    background: #ffffff;
    margin-bottom: 1rem;
    max-width: 31.7%;
  }

  .reputation-image-button,
  .resource-edit-image-button {
    align-self: center;
    width: 100%;
    height: 56px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s ease;
  }

  .reputation-image-button:hover,
  .resource-edit-image-button:hover {
    transform: scale(1.05);
  }

  .reputation-image,
  .resource-image {
    background: #000000;
    height: 56px;
    object-fit: cover;
    width: 100%;
    border-radius: 8px;
    border: 2px solid #6b7280;
  }

  .add-reputation-form .reputation-image-button:hover .reputation-image,
  .add-resource-form .resource-edit-image-button:hover .resource-image {
    border-color: #9ca3af;
  }

  .reputation-input,
  .resource-input {
    background: transparent;
    border: solid 1px #000000;
    color: #000000;
    padding: 0.5rem;
    border-radius: 4px;
  }

  .reputation-input.number,
  .resource-input.number {
    width: 48px;
  }

  .reputation-input:focus,
  .resource-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .reputation-textarea,
  .resource-textarea {
    background: transparent;
    border: solid 1px #000000;
    margin-bottom: 0.5rem;
    font-family: "Overpass", sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #000000;
    width: 100%;
    padding: 0.5rem;
    border-radius: 4px;
    resize: vertical;
    min-height: 80px;
  }

  .reputation-textarea:focus,
  .resource-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }
</style>
