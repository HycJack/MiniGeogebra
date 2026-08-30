import { IKernel } from './Interfaces';
import { Construction } from './Construction';
import { ConstructionElement } from './ConstructionElement';
import { AnimationManager } from './AnimationManager';

export class Kernel implements IKernel {
  private construction: Construction;
  private updateCallback: (() => void) | null = null;
  private animationManager: AnimationManager;

  // 微任务级批处理：同一个事件循环 tick 内的多次 notifyUpdate 合并为一次增量更新，
  // 避免拖动时每一帧都全场重算（原 updateAllAlgorithms 行为）。
  private pendingUpdates = new Set<ConstructionElement>();
  private flushScheduled = false;

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

  setUpdateCallback(callback: () => void) {
    this.updateCallback = callback;
  }

  /**
   * 元素变化通知。新语义：
   * - 若是“独立”元素（如用户拖动的自由点），把它加入待更新集合并安排一次微任务 flush；
   *   flush 时只对真正依赖它的算法做增量重算（按 constIndex 拓扑序），不再全场更新。
   * - 最终调用 updateCallback 通知视图刷新（由视图层做 RAF/revision 节流）。
   */
  notifyUpdate(element: ConstructionElement): void {
    if (element.isIndependent()) {
      this.pendingUpdates.add(element);
      if (!this.flushScheduled) {
        this.flushScheduled = true;
        Promise.resolve().then(() => this.flushPendingUpdates());
      }
    }
    if (this.updateCallback) {
      this.updateCallback();
    }
  }

  /**
   * Flush 受影响的算法。只收集依赖任一 pending 元素的算法并按构造序执行；
   * 被 Algo 内部 compute() 再次 setCoords 的输出元素不会再触发新的 flush（它们不独立），
   * 从而避免重入与重复计算。
   */
  private flushPendingUpdates(): void {
    this.flushScheduled = false;
    if (this.pendingUpdates.size === 0) return;

    const affected = new Set<import('../algo/AlgoElement').AlgoElement>();
    for (const el of this.pendingUpdates) {
      for (const algo of this.construction.getDependentAlgorithms(el)) {
        affected.add(algo);
      }
    }

    const sorted = Array.from(affected).sort(
      (a, b) => a.constIndex - b.constIndex
    );
    for (const algo of sorted) {
      algo.update();
    }
    this.pendingUpdates.clear();
  }

  /**
   * 同步 flush pending updates（拖动等场景需要“本帧立即重算依赖”，不能等微任务）。
   */
  flushNow(): void {
    if (!this.flushScheduled || this.pendingUpdates.size === 0) return;
    this.flushScheduled = false;
    const affected = new Set<import('../algo/AlgoElement').AlgoElement>();
    for (const el of this.pendingUpdates) {
      for (const algo of this.construction.getDependentAlgorithms(el)) {
        affected.add(algo);
      }
    }
    const sorted = Array.from(affected).sort((a, b) => a.constIndex - b.constIndex);
    for (const algo of sorted) algo.update();
    this.pendingUpdates.clear();
  }
}
