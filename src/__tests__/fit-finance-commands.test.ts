/**
 * 拟合族 + 金融族 + 限域函数回归（L4-A3/A4/A8/A10，官方 CmdFitExp/CmdFunction 对齐）：
 * FitExp/FitGrowth/FitLog/FitPow/FitLineX/FitLineY、FutureValue/PresentValue/Payment/Rate、
 * Function(f,a,b) 限域（求值域外 NaN、采样截断、活依赖）、序列化 roundtrip。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { futureValue, presentValue, payment, rate } from '../kernel/algo/AlgoFinance';

const findEl = <T>(kernel: ReturnType<typeof makeKernel>, cls: new (...a: never[]) => T, label?: string): T =>
  kernel.getConstruction().getElements().find(
    el => el instanceof cls && (label === undefined || (el as { label?: string }).label === label),
  ) as T;

const addInput = (kernel: ReturnType<typeof makeKernel>, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

describe('L4-A8 拟合族（官方 CmdFitExp / CmdFitLineX / ...）', () => {
  it('FitExp：y = 2e^{0.5x} 数据精确还原', () => {
    const k = makeKernel();
    for (const [x, y] of [[0, 2], [1, 2 * Math.exp(0.5)], [2, 2 * Math.exp(1)], [3, 2 * Math.exp(1.5)]]) {
      makePoint(k, x, y, `P${x}`);
    }
    addInput(k, 'f = FitExp({P0, P1, P2, P3})');
    const f = findEl(k, GeoFunction, 'f');
    expect(f).toBeDefined();
    expect(f.isDefined()).toBe(true);
    expect(f.evaluateAt(2)).toBeCloseTo(2 * Math.exp(1), 6);
    expect(f.evaluateAt(4)).toBeCloseTo(2 * Math.exp(2), 6);
  });

  it('FitGrowth：y = 3·2^x', () => {
    const k = makeKernel();
    for (const [x, y] of [[0, 3], [1, 6], [2, 12], [3, 24]]) {
      makePoint(k, x, y, `G${x}`);
    }
    addInput(k, 'g = FitGrowth({G0, G1, G2, G3})');
    const g = findEl(k, GeoFunction, 'g');
    expect(g.evaluateAt(2.5)).toBeCloseTo(3 * Math.pow(2, 2.5), 6);
  });

  it('FitLog：y = 1 + 2·ln x（x>0 点）', () => {
    const k = makeKernel();
    for (const x of [1, 2, 4, 8]) {
      makePoint(k, x, 1 + 2 * Math.log(x), `L${x}`);
    }
    addInput(k, 'h = FitLog({L1, L2, L4, L8})');
    const h = findEl(k, GeoFunction, 'h');
    expect(h.evaluateAt(8)).toBeCloseTo(1 + 2 * Math.log(8), 6);
  });

  it('FitPow：y = 2·x^1.5（x,y>0）', () => {
    const k = makeKernel();
    for (const x of [1, 2, 4, 8]) {
      makePoint(k, x, 2 * Math.pow(x, 1.5), `W${x}`);
    }
    addInput(k, 'p = FitPow({W1, W2, W4, W8})');
    const p = findEl(k, GeoFunction, 'p');
    expect(p.evaluateAt(9)).toBeCloseTo(2 * Math.pow(9, 1.5), 5);
  });

  it('Fit/FitLineY：y 对 x 回归 → GeoLine；FitLineX 反向', () => {
    const k = makeKernel();
    for (const [x, y] of [[0, 1], [1, 3], [2, 5], [3, 7]]) {
      makePoint(k, x, y, `Q${x}`);
    }
    addInput(k, 'l1 = Fit({Q0, Q1, Q2, Q3})');
    const l1 = findEl(k, GeoLine, 'l1');
    expect(l1.isDefined()).toBe(true);
    // y = 2x + 1 → −2x + y − 1 = 0
    expect(l1.a).toBeCloseTo(-2, 9);
    expect(l1.c).toBeCloseTo(-1, 9);
    // FitLineX：x = y/2 − 0.5 → x − 0.5y + 0.5 = 0
    addInput(k, 'l2 = FitLineX({Q0, Q1, Q2, Q3})');
    const l2 = findEl(k, GeoLine, 'l2');
    expect(l2.a).toBeCloseTo(1, 9);
    expect(l2.b).toBeCloseTo(-0.5, 9);
    expect(l2.c).toBeCloseTo(0.5, 9);
  });

  it('活依赖：移动点后重新拟合', () => {
    const k = makeKernel();
    const p0 = makePoint(k, 0, 1, 'R0');
    makePoint(k, 1, 3, 'R1');
    makePoint(k, 2, 5, 'R2');
    makePoint(k, 3, 7, 'R3');
    addInput(k, 'l = Fit({R0, R1, R2, R3})');
    const l = findEl(k, GeoLine, 'l');
    expect(l.a).toBeCloseTo(-2, 9);
    p0.setCoords(0, 2);   // 移到 (0,2)：回归 a=1.7, b=1.7（最小二乘，非插值）
    k.getConstruction().updateAllAlgorithms();
    expect(l.a).toBeCloseTo(-1.7, 9);
    expect(l.c).toBeCloseTo(-1.7, 9);
  });
});

describe('L4-A10 金融族（官方 TABLE_FINANCIAL，标准 TVM 公式）', () => {
  it('FutureValue：终值公式', () => {
    // PV=−1000, PMT=−100, r=0.05/年, 10 期, 期末支付
    const fv = futureValue(0.05, 10, -100, -1000, 0);
    expect(fv).toBeCloseTo(1000 * Math.pow(1.05, 10) + 100 * ((Math.pow(1.05, 10) - 1) / 0.05), 6);
  });

  it('PresentValue：与 FutureValue 互逆', () => {
    const fv = futureValue(0.08, 5, -50, -200, 0);
    const pv = presentValue(0.08, 5, -50, fv, 0);
    expect(pv).toBeCloseTo(-200, 6);
  });

  it('Payment：零利率退化为线性均摊；利率下与 Excel PMT 符号约定一致', () => {
    expect(payment(0, 10, -1000, 0, 0)).toBeCloseTo(100, 9);
    // Excel PMT(0.01,12,-1200) = +106.6185：pv 也随利息增长（TVM 标准）
    const pmt = payment(0.01, 12, -1200, 0, 0);
    expect(pmt).toBeCloseTo(1200 * Math.pow(1.01, 12) * 0.01 / (Math.pow(1.01, 12) - 1), 6);
  });

  it('Rate：牛顿迭代还原已知利率', () => {
    const r = rate(10, -100, -1000, 1000 * Math.pow(1.05, 10) + 100 * ((Math.pow(1.05, 10) - 1) / 0.05), 0, 0.1);
    expect(r).toBeCloseTo(0.05, 8);
  });

  it('命令面：Rate/FutureValue 静态求值', () => {
    const k = makeKernel();
    addInput(k, 'fv2 = FutureValue(0.1, 2, 0, -100)');
    expect(findEl(k, GeoNumeric, 'fv2').getValue()).toBeCloseTo(121, 6);
    addInput(k, 'rt = Rate(2, 0, -100, 121)');
    expect(findEl(k, GeoNumeric, 'rt').getValue()).toBeCloseTo(0.1, 8);
  });
});

describe('Function(f, a, b) 限域函数（官方 CmdFunction 三参形）', () => {
  it('求值：域内正常、域外 NaN', () => {
    const k = makeKernel();
    addInput(k, 'g(x) = x^2');
    addInput(k, 'gr = Function(g, 0, 2)');
    const gr = findEl(k, GeoFunction, 'gr');
    expect(gr).toBeDefined();
    expect(gr.evaluateAt(1)).toBeCloseTo(1, 9);
    expect(gr.evaluateAt(2)).toBeCloseTo(4, 9);
    expect(gr.evaluateAt(3)).toBeNaN();
    expect(gr.evaluateAt(-1)).toBeNaN();
    // 源函数不受限
    const g = findEl(k, GeoFunction, 'g');
    expect(g.evaluateAt(3)).toBeCloseTo(9, 9);
  });

  it('采样截断：样本只在 [a, b] 内', () => {
    const k = makeKernel();
    addInput(k, 'g(x) = x^2');
    addInput(k, 'gr = Function(g, -1, 1)');
    const gr = findEl(k, GeoFunction, 'gr');
    const samples = gr.updateSamples(-10, 10, 800);
    expect(samples.length).toBeGreaterThan(0);
    expect(Math.min(...samples.map(s => s.x))).toBeGreaterThanOrEqual(-1 - 1e-9);
    expect(Math.max(...samples.map(s => s.x))).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('活依赖：滑块端点跟随', () => {
    const k = makeKernel();
    addInput(k, 'g(x) = x^2');
    addInput(k, 'b = Slider(1, 3, 1)');
    addInput(k, 'gr = Function(g, 0, b)');
    const gr = findEl(k, GeoFunction, 'gr');
    expect(gr.evaluateAt(1.5)).toBeCloseTo(2.25, 9);  // b 初值 = 2（区间中点）
    const b = findEl(k, GeoNumeric, 'b');
    b.setValue(1);
    k.getConstruction().updateAllAlgorithms();
    expect(gr.evaluateAt(1.5)).toBeNaN();
  });

  it('序列化 roundtrip：限域与活端点重建', () => {
    const k = makeKernel();
    addInput(k, 'g(x) = x^2');
    addInput(k, 'gr = Function(g, 0, 2)');
    const json = serialize(k);
    const k2 = makeKernel();
    deserialize(k2, json);
    k2.getConstruction().updateAllAlgorithms();
    const gr2 = findEl(k2, GeoFunction, 'gr');
    expect(gr2).toBeDefined();
    expect(gr2.getDomainMin()).toBe(0);
    expect(gr2.getDomainMax()).toBe(2);
    expect(gr2.evaluateAt(3)).toBeNaN();
  });
});
