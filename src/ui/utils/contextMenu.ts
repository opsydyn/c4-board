import { Menu, Submenu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import type { PhysicalPosition } from '@tauri-apps/api/dpi';

/**
 * Context Menu Builder for C4 Canvas
 * Uses Tauri's native Menu API for OS-native context menus
 */

export type ContextMenuAction =
  | { type: 'edit' }
  | { type: 'duplicate' }
  | { type: 'delete' }
  | { type: 'add-connected' }
  | { type: 'change-type'; nodeType: string }
  | { type: 'add-node'; nodeType: string; position?: { x: number; y: number } | undefined }
  | { type: 'auto-layout' }
  | { type: 'export' }
  | { type: 'paste' }
  | { type: 'edit-label' }
  | { type: 'change-edge-style'; style: 'solid' | 'dashed' | 'dotted' }
  | { type: 'reverse-direction' }
  | { type: 'delete-edge' };

/**
 * Creates context menu for nodes
 */
export async function createNodeContextMenu(
  onAction: (action: ContextMenuAction) => void
): Promise<Menu> {
  // Change Type submenu
  const changeTypeSubmenu = await Submenu.new({
    text: 'Change Type',
    items: [
      // C4 types
      await MenuItem.new({
        text: 'C4 Nodes',
        enabled: false,
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Person',
        action: () => onAction({ type: 'change-type', nodeType: 'person' }),
      }),
      await MenuItem.new({
        text: 'System',
        action: () => onAction({ type: 'change-type', nodeType: 'system' }),
      }),
      await MenuItem.new({
        text: 'External System',
        action: () => onAction({ type: 'change-type', nodeType: 'externalSystem' }),
      }),
      await MenuItem.new({
        text: 'Container',
        action: () => onAction({ type: 'change-type', nodeType: 'container' }),
      }),
      await MenuItem.new({
        text: 'Component',
        action: () => onAction({ type: 'change-type', nodeType: 'component' }),
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      // DDD types
      await MenuItem.new({
        text: 'DDD Nodes',
        enabled: false,
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Aggregate',
        action: () => onAction({ type: 'change-type', nodeType: 'aggregate' }),
      }),
      await MenuItem.new({
        text: 'Entity',
        action: () => onAction({ type: 'change-type', nodeType: 'entity' }),
      }),
      await MenuItem.new({
        text: 'Value Object',
        action: () => onAction({ type: 'change-type', nodeType: 'valueObject' }),
      }),
      await MenuItem.new({
        text: 'Domain Event',
        action: () => onAction({ type: 'change-type', nodeType: 'domainEvent' }),
      }),
      await MenuItem.new({
        text: 'Domain Service',
        action: () => onAction({ type: 'change-type', nodeType: 'domainService' }),
      }),
      await MenuItem.new({
        text: 'Repository',
        action: () => onAction({ type: 'change-type', nodeType: 'repository' }),
      }),
      await MenuItem.new({
        text: 'Factory',
        action: () => onAction({ type: 'change-type', nodeType: 'factory' }),
      }),
      await MenuItem.new({
        text: 'Command',
        action: () => onAction({ type: 'change-type', nodeType: 'command' }),
      }),
      await MenuItem.new({
        text: 'Query',
        action: () => onAction({ type: 'change-type', nodeType: 'query' }),
      }),
      await MenuItem.new({
        text: 'Application Service',
        action: () => onAction({ type: 'change-type', nodeType: 'applicationService' }),
      }),
      await MenuItem.new({
        text: 'Integration Event',
        action: () => onAction({ type: 'change-type', nodeType: 'integrationEvent' }),
      }),
      await MenuItem.new({
        text: 'ACL',
        action: () => onAction({ type: 'change-type', nodeType: 'acl' }),
      }),
      await MenuItem.new({
        text: 'Saga',
        action: () => onAction({ type: 'change-type', nodeType: 'saga' }),
      }),
      await MenuItem.new({
        text: 'Bounded Context',
        action: () => onAction({ type: 'change-type', nodeType: 'boundedContext' }),
      }),
    ],
  });

  return await Menu.new({
    items: [
      await MenuItem.new({
        text: 'Edit Node',
        action: () => onAction({ type: 'edit' }),
      }),
      await MenuItem.new({
        text: 'Duplicate',
        action: () => onAction({ type: 'duplicate' }),
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Delete',
        action: () => onAction({ type: 'delete' }),
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      changeTypeSubmenu,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Add Connected Node...',
        action: () => onAction({ type: 'add-connected' }),
      }),
    ],
  });
}

/**
 * Creates context menu for canvas background
 */
export async function createCanvasContextMenu(
  onAction: (action: ContextMenuAction) => void,
  clickPosition?: { x: number; y: number }
): Promise<Menu> {
  // Add Node submenu
  const addNodeSubmenu = await Submenu.new({
    text: 'Add Node',
    items: [
      // C4 types
      await MenuItem.new({
        text: 'C4 Nodes',
        enabled: false,
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Person',
        action: () => onAction({ type: 'add-node', nodeType: 'person', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'System',
        action: () => onAction({ type: 'add-node', nodeType: 'system', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'External System',
        action: () => onAction({ type: 'add-node', nodeType: 'externalSystem', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Container',
        action: () => onAction({ type: 'add-node', nodeType: 'container', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Component',
        action: () => onAction({ type: 'add-node', nodeType: 'component', position: clickPosition }),
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      // DDD types
      await MenuItem.new({
        text: 'DDD Nodes',
        enabled: false,
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Aggregate',
        action: () => onAction({ type: 'add-node', nodeType: 'aggregate', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Entity',
        action: () => onAction({ type: 'add-node', nodeType: 'entity', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Value Object',
        action: () => onAction({ type: 'add-node', nodeType: 'valueObject', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Domain Event',
        action: () => onAction({ type: 'add-node', nodeType: 'domainEvent', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Domain Service',
        action: () => onAction({ type: 'add-node', nodeType: 'domainService', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Repository',
        action: () => onAction({ type: 'add-node', nodeType: 'repository', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Factory',
        action: () => onAction({ type: 'add-node', nodeType: 'factory', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Command',
        action: () => onAction({ type: 'add-node', nodeType: 'command', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Query',
        action: () => onAction({ type: 'add-node', nodeType: 'query', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Application Service',
        action: () => onAction({ type: 'add-node', nodeType: 'applicationService', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Integration Event',
        action: () => onAction({ type: 'add-node', nodeType: 'integrationEvent', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'ACL',
        action: () => onAction({ type: 'add-node', nodeType: 'acl', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Saga',
        action: () => onAction({ type: 'add-node', nodeType: 'saga', position: clickPosition }),
      }),
      await MenuItem.new({
        text: 'Bounded Context',
        action: () => onAction({ type: 'add-node', nodeType: 'boundedContext', position: clickPosition }),
      }),
    ],
  });

  return await Menu.new({
    items: [
      addNodeSubmenu,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Auto Layout',
        accelerator: 'CmdOrCtrl+Shift+L',
        action: () => onAction({ type: 'auto-layout' }),
      }),
      await MenuItem.new({
        text: 'Export...',
        accelerator: 'CmdOrCtrl+E',
        action: () => onAction({ type: 'export' }),
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Undo',
        accelerator: 'CmdOrCtrl+Z',
        action: () => {}, // Handled by browser/system
      }),
      await MenuItem.new({
        text: 'Redo',
        accelerator: 'CmdOrCtrl+Shift+Z',
        action: () => {}, // Handled by browser/system
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Paste',
        accelerator: 'CmdOrCtrl+V',
        action: () => onAction({ type: 'paste' }),
      }),
    ],
  });
}

/**
 * Creates context menu for edges
 */
export async function createEdgeContextMenu(
  onAction: (action: ContextMenuAction) => void
): Promise<Menu> {
  // Change Style submenu
  const changeStyleSubmenu = await Submenu.new({
    text: 'Change Style',
    items: [
      await MenuItem.new({
        text: 'Solid',
        action: () => onAction({ type: 'change-edge-style', style: 'solid' }),
      }),
      await MenuItem.new({
        text: 'Dashed',
        action: () => onAction({ type: 'change-edge-style', style: 'dashed' }),
      }),
      await MenuItem.new({
        text: 'Dotted',
        action: () => onAction({ type: 'change-edge-style', style: 'dotted' }),
      }),
    ],
  });

  return await Menu.new({
    items: [
      await MenuItem.new({
        text: 'Edit Label',
        action: () => onAction({ type: 'edit-label' }),
      }),
      changeStyleSubmenu,
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Reverse Direction',
        action: () => onAction({ type: 'reverse-direction' }),
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        text: 'Delete',
        action: () => onAction({ type: 'delete-edge' }),
      }),
    ],
  });
}

/**
 * Shows a context menu at the given position
 */
export async function showContextMenu(menu: Menu, position?: PhysicalPosition): Promise<void> {
  await menu.popup(position);
}
