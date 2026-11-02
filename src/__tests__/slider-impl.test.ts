/**
 * 画布滑条重实现回归（对标官方 DrawSlider / CmdSlider / moveSlider）：
 * - 滑条从 HTML widget 迁为内核 drawable（GeoNumeric 滑条字段 + 画布渲染）；
 * - 几何/命中/取值投影为纯函数（sliderDrawable.ts）；
 * - Slider 命令对齐官方 arity [2,9]（第 4 参 = 动画速度而非初值）；
 * - 序列化 roundtrip 保留滑条字段。
 */
import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { makeKernel } from './helpers';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { sliderGeomScreen, sliderHitAt, sliderValueAtMouse } from '../components/sliderDrawable';

const addInput = (kernel: Kernel, text: string): ConstructionElement[] => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const makeSlider = (kernel: Kernel, opts?: Partial<{ min: number; max: number; inc: number; x: number; y: number; w: number; h: boolean; value: number }>): GeoNumeric => {
  const n = new GeoNumeric(kernel, opts?.value ?? 0);
  n.intervalMin = opts?.min ?? 0;
  n.intervalMax = opts?.max ?? 10;
  n.animationIncrement = opts?.inc ?? 1;
  n.sliderVisible = true;
  n.sliderX = opts?.x ?? 100;
  n.sliderY = opts?.y ?? 100;
  n.sliderWidthPx = opts?.w ?? 200;
  n.sliderHorizontal = opts?.h ?? true;
  return n;
}

describe('sliderGeomScreen（官方 DrawSlider 几何）', () => {
  it('水平滑条：轨道向右、滑块按值参数定位', () => {
    const n = makeSlider(makeKernel(), { min: 0, max: 10, value: 5 });
    const g = sliderGeomScreen(n);
    expect(g.sx).toBe(100);
    expect(g.sy).toBe(100);
    expect(g.ex).toBe(300);
    expect(g.ey).toBe(100);
    expect(g.kx).toBe(200); // 参数 0.5
    expect(g.ky).toBe(100);
  });

  it('垂直滑条：轨道向上延伸（官方 sy − w）', () => {
    const n = makeSlider(makeKernel(), { value: 2.5, h: false });
    const g = sliderGeomScreen(n);
    expect(g.ex).toBe(100);
    expect(g.ey).toBe(-100); // 100 − 200
    expect(g.ky).toBe(50);   // 参数 0.25 → 100 − 50
  });
});

describe('sliderValueAtMouse（官方 moveNumeric 投影语义）', () => {
  it('鼠标位置投影到轨道取值', () => {
    const n = makeSlider(makeKernel(), { min: 0, max: 10, inc: 0 });
    // 轨道 x∈[100,300]：鼠标 x=150 → 参数 0.25 → 值 2.5
    expect(sliderValueAtMouse(n, 150, 100)).toBeCloseTo(2.5, 9);
    // 垂直：鼠标 y=50（轨道向上）→ 参数 0.25 → 值 2.5
    const v = makeSlider(makeKernel(), { min: 0, max: 10, inc: 0, h: false });
    expect(sliderValueAtMouse(v, 100, 50)).toBeCloseTo(2.5, 9);
  });

  it('区间外钳制 + increment 吸附', () => {
    const n = makeSlider(makeKernel(), { min: 0, max: 10, inc: 0.5 });
    expect(sliderValueAtMouse(n, 50, 100)).toBe(0);     // 左外 → 钳 0
    expect(sliderValueAtMouse(n, 500, 100)).toBe(10);   // 右外 → 钳 10
    expect(sliderValueAtMouse(n, 123, 100)).toBe(1);    // 参数 0.115 → 1.15 → 吸附 1.0
  });

  it('valueAtParam 吸附到 increment 网格', () => {
    const n = makeSlider(makeKernel(), { min: 0, max: 10, inc: 0.5 });
    expect(n.valueAtParam(0.115)).toBeCloseTo(1, 9);   // 1.15 → 1.0
    expect(n.valueAtParam(0.13)).toBeCloseTo(1.5, 9);  // 1.3 → 1.5
    expect(n.valueAtParam(-0.5)).toBe(0);
    expect(n.valueAtParam(1.5)).toBe(10);
  });
});

describe('sliderHitAt（官方 hitPoint / hitSliderNotBlob）', () => {
  it('滑块命中 → knob；轨道其余处 → track；远处 → null', () => {
    const n = makeSlider(makeKernel(), { min: 0, max: 10, value: 5 }); // knob (200,100)
    expect(sliderHitAt(n, 202, 101)).toBe('knob');
    expect(sliderHitAt(n, 130, 101)).toBe('track');  // 轨道上、滑块左
    expect(sliderHitAt(n, 130, 130)).toBeNull();     // 离轨道 30px
    // 轨道上但紧贴滑块（≤ threshold*2+blob）仍算 knob
    expect(sliderHitAt(n, 190, 100)).toBe('knob');
  });
});

describe('Slider 命令（官方 CmdSlider arity [2,9]）', () => {
  it('Slider(-5, 5, 0.1, 2, 300, false, false) 全参数形态', () => {
    const k = makeKernel();
    addInput(k, 's1 = Slider(-5, 5, 0.1, 2, 300, false, false)');
    const n = k.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).label === 's1') as GeoNumeric;
    expect(n).toBeDefined();
    expect(n.intervalMin).toBe(-5);
    expect(n.intervalMax).toBe(5);
    expect(n.animationIncrement).toBe(0.1);
    expect(n.animationSpeed).toBe(2);
    expect(n.sliderWidthPx).toBe(300);
    expect(n.sliderHorizontal).toBe(false);
    expect(n.sliderVisible).toBe(true);
    expect(n.getValue()).toBe(0); // 区间中点
  });

  it('第 8/9 参：创建即动画 + 随机类型', () => {
    const k = makeKernel();
    addInput(k, 's1 = Slider(0, 10, 1, 1, 200, false, true, true, true)');
    const n = k.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).sliderVisible) as GeoNumeric;
    expect(n.isAnimating()).toBe(true);
    expect(n.animationType).toBe(4); // AnimationType.RANDOM
    // 收尾：停掉动画避免影响其他用例
    n.setAnimating(false);
  });

  it('连续 Slider() 自动纵向堆叠避让', () => {
    const k = makeKernel();
    addInput(k, 's1 = Slider(0, 10, 1)');
    addInput(k, 's2 = Slider(0, 10, 1)');
    const nums = k.getConstruction().getElements()
      .filter(el => el instanceof GeoNumeric && (el as GeoNumeric).sliderVisible) as GeoNumeric[];
    expect(nums.length).toBe(2);
    expect(nums[1].sliderY).toBeGreaterThan(nums[0].sliderY);
    expect(nums[1].sliderX).toBe(nums[0].sliderX);
  });
});

describe('滑条序列化 roundtrip', () => {
  it('sliderVisible/位置/宽度/方向随存档保留', () => {
    const k = makeKernel();
    addInput(k, 's1 = Slider(0, 10, 0.5, 1, 250, false, false)');
    deserialize(k, serialize(k));
    k.getConstruction().updateAllAlgorithms();
    const n = k.getConstruction().getElements().find(el => el instanceof GeoNumeric && (el as GeoNumeric).sliderVisible) as GeoNumeric | undefined;
    expect(n).toBeDefined();
    expect(n!.sliderWidthPx).toBe(250);
    expect(n!.sliderHorizontal).toBe(false);
    expect(n!.sliderX).toBe(70);      // makeSliderDrawable 自动摆放位置
    expect(n!.sliderY).toBe(170);
    expect(n!.animationIncrement).toBe(0.5);
  });
});

describe('滑条值变化驱动依赖（内核联动）', () => {
  it('valueAtParam setValue 后下游函数跟随', () => {
    const k = makeKernel();
    const n = makeSlider(k, { min: 0, max: 10, inc: 0 });
    n.label = 'a';
    k.getConstruction().addElement(n);
    addInput(k, 'f(x) = a*x');
    const fn = k.getConstruction().getElements().find(el => (el as any).evaluateAt) as any;
    n.setValue(3);
    k.getConstruction().updateAllAlgorithms();
    expect(fn.evaluateAt(2)).toBeCloseTo(6, 9);
    // 投影拖拽路径：鼠标 x=260 → 参数 0.8 → 值 8
    n.setValue(sliderValueAtMouse(n, 260, 100));
    k.getConstruction().updateAllAlgorithms();
    expect(fn.evaluateAt(2)).toBeCloseTo(16, 9);
  });
});
