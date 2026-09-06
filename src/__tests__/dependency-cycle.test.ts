/**
 * Construction 依赖分析单测。
 *
 * 核心回归点：`isDependentOn` 原先是纯递归，依赖图一旦出现环就会无限递归 → 栈溢出。
 * 环在正常构造中不会出现，但导入损坏存档 / 对象互相引用时会构造出来，
 * 那时应该优雅地返回 false，而不是把整个画布进程打死（对标 GeoGebra 的 cycle 检测）。
 *
 * 覆盖：
 *   1. 线性链 / 菱形依赖仍正确判定（visited 剪枝不能漏报）
 *   2. 二元环、自环不死循环
 *   3. 环与真实依赖共存时既终止又不漏报
 *   4. getDependentAlgorithms 不把环上节点误报为依赖 target
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint } from './helpers';
import type { Kernel } from '../kernel/core/Kernel';
import { AlgoElement } from '../kernel/algo/AlgoElement';
import { GeoElement } from '../kernel/geo/GeoElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoVec3D } from '../kernel/core/GeoVec3D';

/** 测试用最小算法：输出固定，输入由外部注入 —— 便于人为构造环。 */
class StubAlgo extends AlgoElement {
  constructor(kernel: Kernel, outputs: GeoElement[]) {
    super(kernel);
    this.setOutputs(outputs);
  }

  private setOutputs(outputs: GeoElement[]): void {
    this.output = outputs;
    outputs.forEach(o => o.parentAlgo = this);
  }

  setInputOutput(): void {}

  setInputs(inputs: GeoElement[]): void {
    this.input = inputs;
  }

  compute(): void {}
}

function makeOutputPoint(kernel: Kernel): GeoPoint {
  return new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
}

describe('isDependentOn —— 基础依赖判定', () => {
  it('线性链：A → B → P 判定为依赖', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0);

    const bOut = makeOutputPoint(kernel);
    const b = new StubAlgo(kernel, [bOut]);
    kernel.getConstruction().addElement(b);
    b.setInputs([p]);

    const aOut = makeOutputPoint(kernel);
    const a = new StubAlgo(kernel, [aOut]);
    kernel.getConstruction().addElement(a);
    a.setInputs([bOut]);

    expect(kernel.getConstruction().isDependentOn(a, p)).toBe(true);
    expect(kernel.getConstruction().isDependentOn(b, p)).toBe(true);
  });

  it('菱形依赖不产生漏报（两个分支共享同一上游）', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0);

    const dOut = makeOutputPoint(kernel);
    const d = new StubAlgo(kernel, [dOut]);
    kernel.getConstruction().addElement(d);
    d.setInputs([p]);

    const cOut = makeOutputPoint(kernel);
    const c = new StubAlgo(kernel, [cOut]);
    kernel.getConstruction().addElement(c);
    c.setInputs([dOut, dOut]);

    expect(kernel.getConstruction().isDependentOn(c, p)).toBe(true);
  });

  it('完全无关的算法判定为不依赖', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0);
    const other = makePoint(kernel, 1, 1);

    const qOut = makeOutputPoint(kernel);
    const q = new StubAlgo(kernel, [qOut]);
    kernel.getConstruction().addElement(q);
    q.setInputs([other]);

    expect(kernel.getConstruction().isDependentOn(q, p)).toBe(false);
  });
});

describe('isDependentOn —— 环不死循环', () => {
  /**
   * 拓扑：
   *   游离环  a ↔ b          （与 p 无关）
   *   真实链  p → d → pd
   *   汇入点  c.inputs = [pd, pa]   ← 遍历 c 时会扎入环里，必须能终止
   */
  const build = () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0);

    // 游离环
    const pa = makeOutputPoint(kernel);
    const pb = makeOutputPoint(kernel);
    const a = new StubAlgo(kernel, [pa]);
    const b = new StubAlgo(kernel, [pb]);
    kernel.getConstruction().addElement(a);
    kernel.getConstruction().addElement(b);
    a.setInputs([pb]);
    b.setInputs([pa]);

    // 真实链 p → d → pd
    const pd = makeOutputPoint(kernel);
    const d = new StubAlgo(kernel, [pd]);
    kernel.getConstruction().addElement(d);
    d.setInputs([p]);

    // c 同时依赖 pd 和环上的 pa
    const pc = makeOutputPoint(kernel);
    const c = new StubAlgo(kernel, [pc]);
    kernel.getConstruction().addElement(c);
    c.setInputs([pd, pa]);

    return { kernel, p, a, b, c, d };
  };

  it('游离环上的节点不死循环，且不把环外目标报为依赖', () => {
    const { kernel, p, a, b } = build();

    expect(() => kernel.getConstruction().isDependentOn(a, p)).not.toThrow();
    expect(kernel.getConstruction().isDependentOn(a, p)).toBe(false);
    expect(() => kernel.getConstruction().isDependentOn(b, p)).not.toThrow();
    expect(kernel.getConstruction().isDependentOn(b, p)).toBe(false);
  });

  it('自环（算法输入自身输出）不死循环', () => {
    const kernel = makeKernel();
    const p = makePoint(kernel, 0, 0);

    const pa = makeOutputPoint(kernel);
    const a = new StubAlgo(kernel, [pa]);
    kernel.getConstruction().addElement(a);
    a.setInputs([pa]);

    expect(() => kernel.getConstruction().isDependentOn(a, p)).not.toThrow();
    expect(kernel.getConstruction().isDependentOn(a, p)).toBe(false);
  });

  it('遍历扎入环里时能终止，且不漏报真实依赖', () => {
    const { kernel, p, c } = build();

    expect(() => kernel.getConstruction().isDependentOn(c, p)).not.toThrow();
    expect(kernel.getConstruction().isDependentOn(c, p)).toBe(true);
  });

  it('getDependentAlgorithms 只返回真依赖，不把游离环上的节点误报', () => {
    const { kernel, p, a, b, c, d } = build();

    expect(() => kernel.getConstruction().getDependentAlgorithms(p)).not.toThrow();
    const result = kernel.getConstruction().getDependentAlgorithms(p);
    expect(result).toContain(d);
    expect(result).toContain(c);
    expect(result).not.toContain(a);
    expect(result).not.toContain(b);
  });
});
