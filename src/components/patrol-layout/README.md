# Patrol Layout Component

A reusable component that extracts the existing formation system from the groups interface. This component maintains all existing functionality including drag-and-drop, double-click interactions, and editing capabilities.

## Features

- **Exact Same Functionality**: Preserves all existing interactions from the original groups.svelte
- **Pentagon/Hexagon Formation**: Dynamic layout based on maxSoldiers (5 or 6)
- **Drag & Drop Support**: Full drag-and-drop for officers and soldiers
- **Double-click to Open**: Double-click any member to open their character sheet
- **Edit Mode**: Shows remove buttons when in edit mode
- **Reusable**: Can be used in both patrols and administrators sections

## Usage

```svelte
<script>
  import PatrolLayout from '@/components/patrol-layout/patrol-layout.svelte';
  
  let group = {
    id: 'patrol-1',
    officer: { id: '1', name: 'Captain Smith', img: '/path/to/image.jpg' },
    soldiers: [
      { id: '2', name: 'Soldier 1', img: '/path/to/soldier1.jpg' },
      { id: '3', name: 'Soldier 2', img: '/path/to/soldier2.jpg' }
    ],
    maxSoldiers: 5
  };

  let editing = false;
  let labels = {
    officerDrop: 'Drag an officer here',
    soldierDrop: 'Drag soldiers here',
  };

  // Event handlers - connect to your existing functions
  function handleOfficerDrop(event) {
    // Your existing onDropOfficer logic
  }

  function handleOfficerDoubleClick(actorId) {
    // Your existing openActorSheet logic
  }

  // ... other handlers
</script>

<PatrolLayout
  {group}
  {editing}
  {labels}
  on:officerDrop={handleOfficerDrop}
  on:officerDoubleClick={handleOfficerDoubleClick}
  on:removeOfficer={handleRemoveOfficer}
  on:soldierDrop={handleSoldierDrop}
  on:soldierDoubleClick={handleSoldierDoubleClick}
  on:soldierDragStart={handleSoldierDragStart}
  on:removeSoldier={handleRemoveSoldier}
/>
```

## Props

- `group` (Group): The patrol group data containing officer and soldiers
- `editing` (boolean, default: false): Whether the component is in edit mode (shows remove buttons)
- `labels` (object): Labels for drag-and-drop areas

## Events

All events dispatch the exact same data structure as the original implementation:

- `officerDrop`: Fired when an officer is dropped. Receives `{ event, group }`
- `officerDoubleClick`: Fired when officer is double-clicked. Receives actor ID
- `removeOfficer`: Fired when officer remove button is clicked. Receives group
- `soldierDrop`: Fired when a soldier is dropped. Receives `{ event, group, slotIndex }`
- `soldierDoubleClick`: Fired when soldier is double-clicked. Receives actor ID
- `soldierDragStart`: Fired when soldier drag starts. Receives `{ event, soldier }`
- `removeSoldier`: Fired when soldier remove button is clicked. Receives `{ group, slotIndex }`

## Formation Layouts

The component automatically handles different soldier counts:
- **5 soldiers**: Pentagon formation around the officer
- **6 soldiers**: Hexagon formation around the officer

Positions are calculated using the exact same CSS classes as the original:
- `.formation-5-sided.formation-point-{index}`
- `.formation-6-sided.formation-point-{index}`

## Styling

All styles are preserved from the original implementation:
- `.formation-container`: Main container
- `.formation-slot`: Individual member slots
- `.formation-avatar`: Member images
- `.formation-name`: Member names
- `.formation-remove`: Remove buttons
- etc.

## Migration from Original

This component is a direct refactor of the formation section from `groups.svelte`. No functionality was changed, only extracted for reusability.
