import { IKernel } from './Interfaces';
import { Construction } from './Construction';
import { ConstructionElement } from './ConstructionElement';
import { AnimationManager } from './AnimationManager';

export class Kernel implements IKernel {
  private construction: Construction;
  private updateCallback: (() => void) | null = null;
  private animationManager: AnimationManager;

  constructor() {
    this.construction = new Construction(this);
    this.animationManager = new AnimationManager(this);
  }

  getConstruction(): Construction {
    return this.construction;
  }

  getAnimationManager(): AnimationManager {
    return this.animationManager;
  }

  notifyUpdate(element: ConstructionElement): void {
    // When an element updates, we might need to update dependent algorithms
    // For this simple version, we can just update all algorithms or trigger a view refresh
    // In a real system, we would use a dependency graph.
    
    // If it's an input to some algo, we should update algos.
    // Construction.updateAllAlgorithms() does this.
    // But we should be careful not to infinite loop if A updates B and B updates A.
    // Assuming DAG.
    
    // We only trigger updateAllAlgorithms if the change comes from user interaction (e.g. dragging point)
    // If the change comes from an Algo computing, we don't need to re-trigger everything immediately 
    // unless we have a dirty flag system.
    
    // For this prototype, let's assume the UI drives the updates.
    // When UI drags a point -> point.setCoords -> point.update() -> notifyUpdate
    // -> construction.updateAllAlgorithms() -> updates dependent objects.
    
    // We need to avoid re-entrancy if updateAllAlgorithms triggers notifyUpdate.
    // AlgoElement.update() calls compute() then output.update().
    // output.update() calls notifyUpdate().
    
    // So we need a flag or just rely on the fact that we are updating in topological order.
    // If we just call updateCallback, the view will re-render.
    // But we also need to ensure geometric consistency.
    
    // Let's separate "geometric update" from "view update".
    
    // If this notification comes from a "leaf" change (independent object), we propagate.
    if (element.isIndependent()) {
        this.construction.updateAllAlgorithms();
    }
    
    if (this.updateCallback) {
      this.updateCallback();
    }
  }

  setUpdateCallback(callback: () => void) {
    this.updateCallback = callback;
  }
}
