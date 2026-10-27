/**
 * 第六批回归：重命名级联改写表达式（官方 kernel 统一重写 dependent 定义）、
 * GeoText 位置快照、rounding 统一、Polyline/Vertex 多边形命令。
 */
import { describe, expect, it } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoPolyLine } from '../kernel/geo/GeoPolyLine';
import { GeoText } from '../kernel/geo/GeoText';
import { GeoList } from '../kernel/geo/GeoList';
import { captureMoveState, restoreMoveState, moveStateChanged } from '../kernel/core/MoveSnapshot';
import { formatNumber, formatAngle } from '../kernel/core/Options';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel, makePoint } from './helpers';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const labelOf = <T>(kernel: Kernel, label: string): T | undefined =>
  kernel.getConstruction().getElements().find(el => (el as { label?: string }).label === label) as T | undefined;

describe('重命名级联改写表达式（此前 a 改名后 b=a+1 断链 NaN）', () => {
  it('派生数值：a→z 后 b = a+1 的表达式跟随，值不变', async () => {
    const { AlgoDependentNumeric } = await import('../kernel/algo/AlgoDependentNumeric');
    const k = makeKernel();
    addInput(k, 'a = 2');
    addInput(k, 'b = a + 1');
    const b = labelOf<GeoNumeric>(k, 'b')!;
    expect(b.getValue()).toBe(3);

    const a = labelOf<GeoNumeric>(k, 'a')!;
    a.label = 'z';
    for (const el of k.getConstruction().getElements()) {
      if ((el as { renameDependency?: (f: string, t: string) => void }).renameDependency) {
        (el as unknown as { renameDependency(f: string, t: string): void }).renameDependency('a', 'z');
      }
    }
    k.getConstruction().updateAllAlgorithms();
    expect(b.getValue()).toBe(3); // 不再是 NaN
  });

  it('依赖函数：f→g 改名后 h(x) = f(x)+1 的调用跟随', async () => {
    const { AlgoDependentFunction } = await import('../kernel/algo/AlgoDependentFunction');
    const k = makeKernel();
    addInput(k, 'f(x) = x^2');
    addInput(k, 'h(x) = f(x) + 1');
    const h = labelOf<GeoFunction>(k, 'h')!;
    expect(h.evaluateAt(3)).toBe(10);

    const f = labelOf<GeoFunction>(k, 'f')!;
    f.label = 'g';
    for (const el of k.getConstruction().getElements()) {
      if (el instanceof AlgoDependentFunction) el.renameDependency('f', 'g');
    }
    k.getConstruction().updateAllAlgorithms();
    const h2 = labelOf<GeoFunction>(k, 'h')!;
    expect(h2.evaluateAt(3)).toBe(10);
    // 序列化文本也是新名（roundtrip 一致性）
    const algo = h2.parentAlgo as unknown as { getExpressionText(): string };
    expect(algo.getExpressionText()).toContain('g(');
    expect(algo.getExpressionText()).not.toContain('f(');
  });

  it('条件显隐：依赖数值改名后条件跟随', async () => {
    const k = makeKernel();
    addInput(k, 'n = 0');
    addInput(k, 'P = (1, 1)');
    const p = labelOf<GeoPoint>(k, 'P')!;
    addInput(k, 'SetConditionToShowObject(n > 1, P)');
    expect(p.isEffectivelyVisible()).toBe(false);
    // 改名 n → m 并级联（GeometryCanvas 的 rewriteExpressions 逻辑）
    const n = labelOf<GeoNumeric>(k, 'n')!;
    n.label = 'm';
    for (const el of k.getConstruction().getElements()) {
      if ((el as { renameDependency?: unknown }).renameDependency) {
        (el as unknown as { renameDependency(f: string, t: string): void }).renameDependency('n', 'm');
      } else if ((el as GeoPoint).visibleCondition) {
        const g = el as GeoPoint;
        // 条件 AST 的改写在 GeometryCanvas.rewriteExpressions——此处模拟其核心
        const { renameVariableInAst, astUsesVariable } = await import('../kernel/algebra/renameVariable');
        if (g.visibleCondition && astUsesVariable(g.visibleCondition.ast, 'n')) {
          g.visibleCondition = { ...g.visibleCondition, ast: renameVariableInAst(g.visibleCondition.ast, 'n', 'm') };
        }
      }
    }
    k.getConstruction().updateAllAlgorithms();
    // m 仍是 0 → 条件 false；把 m 改值 → 条件跟随新对象
    const m = labelOf<GeoNumeric>(k, 'm')!;
    m.setValue(2);
    k.getConstruction().updateDependentAlgorithms(m);
    expect(p.isEffectivelyVisible()).toBe(true);
  });
});

describe('GeoText 位置快照（MoveMode.TEXT 拖拽 undo）', () => {
  it('自由文本位置回滚', () => {
    const k = makeKernel();
    const t = new GeoText(k, 'hello', 1, 2);
    t.label = 't1';
    k.getConstruction().addElement(t);

    const before = captureMoveState(k);
    t.setPosition(5, 7);
    expect(moveStateChanged(before, captureMoveState(k))).toBe(true);

    restoreMoveState(k, before);
    expect(t.x).toBe(1);
    expect(t.y).toBe(2);
  });

  it('锚定文本偏移回滚', async () => {
    const { AlgoDependentText } = await import('../kernel/algo/AlgoDependentText');
    const k = makeKernel();
    const anchor = makePoint(k, 0, 0, 'A');
    const algo = new AlgoDependentText(k, { kind: 'string', value: 'hi' } as never, [], 'hi', anchor);
    k.getConstruction().addElement(algo);
    k.getConstruction().addElement(algo.getOutput());
    const text = algo.getOutput();

    const before = captureMoveState(k);
    algo.setOffset(3, -1);
    algo.compute();
    expect(text.x).toBe(3);
    expect(moveStateChanged(before, captureMoveState(k))).toBe(true);

    restoreMoveState(k, before);
    expect(text.x).toBe(0);
    expect(text.y).toBe(0);
  });
});

describe('rounding 选项统一（此前动态文本与折线/弧描述硬编码 2 位）', () => {
  it('formatNumber 按 rounding 输出且去尾零', () => {
    const opts = { rounding: 5 };
    expect(formatNumber(1 / 3, opts)).toBe('0.33333');
    expect(formatNumber(2.5, { rounding: 0 })).toBe('3');
    expect(formatNumber(1.5, { rounding: 2 })).toBe('1.5');
    expect(formatAngle(Math.PI / 2, { rounding: 2, angleUnit: 'degree' })).toBe('90°');
    expect(formatAngle(Math.PI / 2, { rounding: 2, angleUnit: 'radian' })).toBe('1.57');
  });

  it('动态文本跟随 rounding（t = "x=" + 1/3）', async () => {
    const { AlgoDependentText } = await import('../kernel/algo/AlgoDependentText');
    const k = makeKernel();
    k.getOptions().set({ rounding: 5 });
    addInput(k, 'r = 1/3');
    const r = labelOf<GeoNumeric>(k, 'r')!;
    const algo = new AlgoDependentText(k,
      { kind: 'binary', op: '+', left: { kind: 'string', value: 'x=' }, right: { kind: 'variable', name: 'r' } } as never,
      [r], 'x=', undefined);
    algo.compute();
    expect(algo.getOutput().text).toBe('x=0.33333');
  });
});

describe('Polyline / Vertex 多边形命令（此前仅工具可达）', () => {
  it('Polyline(A, B, C)：折线长度与顶点依赖', () => {
    const k = makeKernel();
    addInput(k, 'A = (0,0)');
    addInput(k, 'B = (3,0)');
    addInput(k, 'C = (3,4)');
    addInput(k, 'pl = Polyline(A, B, C)');
    const pl = labelOf<GeoPolyLine>(k, 'pl')!;
    expect(pl).toBeDefined();
    expect(pl.getLength()).toBeCloseTo(7, 9); // 3 + 4
  });

  it('Vertex(poly, 2) 第 2 个顶点；Vertex(poly) 顶点列表', () => {
    const k = makeKernel();
    addInput(k, 'A = (0,0)');
    addInput(k, 'B = (4,0)');
    addInput(k, 'C = (0,3)');
    addInput(k, 'poly = Polygon(A, B, C)');
    addInput(k, 'V2 = Vertex(poly, 2)');
    const v2 = labelOf<GeoPoint>(k, 'V2');
    // 单点形式直接引用顶点对象
    expect(v2).toBeDefined();
    expect(v2!.getX()).toBeCloseTo(4, 9);
    addInput(k, 'vs = Vertex(poly)');
    const list = labelOf<GeoList>(k, 'vs');
    expect(list).toBeDefined();
  });
});
