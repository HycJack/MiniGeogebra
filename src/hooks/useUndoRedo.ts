import { useRef, useCallback, type Dispatch, type SetStateAction } from 'react';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';

export interface StateSnapshot {
  coords: Map<string, { x: number; y: number; z: number }>;
  numerics: Map<string, number>;
}

export type Command =
  | { type: 'add'; elements: ConstructionElement[] }
  | { type: 'delete'; elements: ConstructionElement[] }
  | { type: 'move'; oldState: StateSnapshot; newState: StateSnapshot }
  | { type: 'style'; element: GeoElement; before: Record<string, unknown>; after: Record<string, unknown> }
  | { type: 'numeric'; element: GeoNumeric; oldValue: number; newValue: number }
  | { type: 'rename'; element: ConstructionElement; oldLabel: string; newLabel: string };

export function useUndoRedo(
  kernel: Kernel,
  onRerender: () => void,
  setSelectedElements: Dispatch<SetStateAction<GeoElement[]>>,
  setPolygonPoints: Dispatch<SetStateAction<GeoPoint[]>>,
) {
  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);

  const captureState = useCallback((): StateSnapshot => {
    const coords = new Map<string, { x: number; y: number; z: number }>();
    const numerics = new Map<string, number>();
    kernel.getConstruction().getElements().forEach(el => {
      if (el instanceof GeoPoint && el.isIndependent()) {
        coords.set(el.id, { x: el.getX(), y: el.getY(), z: el.getZ() });
      } else if (el instanceof GeoNumeric) {
        numerics.set(el.id, el.getValue());
      }
    });
    return { coords, numerics };
  }, [kernel]);

  const restoreState = useCallback((state: StateSnapshot) => {
    state.coords.forEach((c, id) => {
      const el = kernel.getConstruction().getElementById(id);
      if (el instanceof GeoPoint) el.setCoords(c.x, c.y, c.z);
    });
    state.numerics.forEach((val, id) => {
      const el = kernel.getConstruction().getElementById(id);
      if (el instanceof GeoNumeric) el.setValue(val);
    });
    kernel.getConstruction().updateAllAlgorithms();
  }, [kernel]);

  const addCommand = useCallback((cmd: Command) => {
    undoStack.current.push(cmd);
    redoStack.current = [];
    onRerender();
  }, [onRerender]);

  const snapshotStyle = useCallback((el: GeoElement): Record<string, unknown> => ({
    strokeColor: el.strokeColor,
    strokeWidth: el.strokeWidth,
    strokeDash: el.strokeDash ? [...el.strokeDash] : [],
    fillColor: el.fillColor,
    labelVisible: el.labelVisible,
    labelMode: el.labelMode,
  }), []);

  const applyStyleDirectly = useCallback((el: GeoElement, changes: Record<string, unknown>) => {
    if ('strokeColor' in changes) el.strokeColor = changes.strokeColor as string | null;
    if ('strokeWidth' in changes) el.strokeWidth = changes.strokeWidth as number | null;
    if ('strokeDash' in changes) el.strokeDash = changes.strokeDash ? [...(changes.strokeDash as number[])] : null;
    if ('fillColor' in changes) el.fillColor = changes.fillColor as string | null;
    if ('labelVisible' in changes) el.labelVisible = changes.labelVisible as boolean;
    if ('labelMode' in changes) el.labelMode = changes.labelMode as 'always' | 'mouse' | 'never';
  }, []);

  const recordStyleChange = useCallback((element: GeoElement, changes: Record<string, unknown>) => {
    applyStyleDirectly(element, changes);
    addCommand({ type: 'style', element, before: snapshotStyle(element), after: { ...changes } });
  }, [applyStyleDirectly, addCommand, snapshotStyle]);

  const recordNumericChange = useCallback((numeric: GeoNumeric, oldValue: number, newValue: number) => {
    if (oldValue !== newValue) {
      addCommand({ type: 'numeric', element: numeric, oldValue, newValue });
    }
  }, [addCommand]);

  const recordRename = useCallback((element: ConstructionElement, newLabel: string) => {
    const oldLabel = (element as any).label || '';
    if (oldLabel !== newLabel) {
      (element as any).label = newLabel;
      addCommand({ type: 'rename', element, oldLabel, newLabel });
    }
  }, [addCommand]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const cmd = undoStack.current.pop()!;
    redoStack.current.push(cmd);

    if (cmd.type === 'add') {
      [...cmd.elements].reverse().forEach(el => kernel.getConstruction().removeElement(el));
      setSelectedElements(prev => prev.filter(e => !(cmd.elements as any[]).includes(e)));
      setPolygonPoints(prev => prev.filter(e => !(cmd.elements as any[]).includes(e)));
    } else if (cmd.type === 'delete') {
      [...cmd.elements].reverse().forEach(el => kernel.getConstruction().deleteElementWithDependents(el));
      setSelectedElements([]);
    } else if (cmd.type === 'move') {
      restoreState(cmd.oldState);
    } else if (cmd.type === 'numeric') {
      const el = kernel.getConstruction().getElementById(cmd.element.id);
      if (el instanceof GeoNumeric) el.setValue(cmd.oldValue);
    } else if (cmd.type === 'rename') {
      const el = kernel.getConstruction().getElementById(cmd.element.id);
      if (el) (el as any).label = cmd.oldLabel;
    } else if (cmd.type === 'style') {
      applyStyleDirectly(cmd.element, cmd.after);
    }
    kernel.getConstruction().updateAllAlgorithms();
    onRerender();
  }, [kernel, restoreState, setSelectedElements, setPolygonPoints, applyStyleDirectly, onRerender]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const cmd = redoStack.current.pop()!;
    undoStack.current.push(cmd);

    if (cmd.type === 'add') {
      cmd.elements.forEach(el => kernel.getConstruction().addElement(el));
    } else if (cmd.type === 'delete') {
      cmd.elements.forEach(el => kernel.getConstruction().addElement(el));
    } else if (cmd.type === 'move') {
      restoreState(cmd.newState);
    } else if (cmd.type === 'numeric') {
      const el = kernel.getConstruction().getElementById(cmd.element.id);
      if (el instanceof GeoNumeric) el.setValue(cmd.newValue);
    } else if (cmd.type === 'rename') {
      const el = kernel.getConstruction().getElementById(cmd.element.id);
      if (el) (el as any).label = cmd.newLabel;
    } else if (cmd.type === 'style') {
      applyStyleDirectly(cmd.element, cmd.before);
    }
    kernel.getConstruction().updateAllAlgorithms();
    onRerender();
  }, [kernel, restoreState, applyStyleDirectly, onRerender]);

  return {
    undoStack,
    redoStack,
    addCommand,
    undo,
    redo,
    captureState,
    restoreState,
    snapshotStyle,
    applyStyleDirectly,
    recordStyleChange,
    recordNumericChange,
    recordRename,
  };
}
