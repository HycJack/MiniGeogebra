/**
 * 圆锥属性拆分族 + 文本命令族回归（L4-A5/A7，官方 AlgoAxes 拆分 / AlgoFractionText 等对齐）：
 * MajorAxis/MinorAxis/FirstAxis/SecondAxis、半轴/全轴长、LinearEccentricity、Sector(circle,A,B)、
 * FractionText/ScientificText/TableText/FormulaText/Name/Split/TextToUnicode/UnicodeToText/
 * LetterToUnicode/UnicodeToLetter、序列化 roundtrip。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, makeLine, EPS } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoConicPart } from '../kernel/geo/GeoConicPart';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoText } from '../kernel/geo/GeoText';
import { GeoList } from '../kernel/geo/GeoList';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { fractionText, scientificText } from '../kernel/algo/AlgoTextOps';

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

describe('L4-A5 圆锥属性拆分族（官方 AlgoAxes 拆分 / Sector）', () => {
  it('椭圆 x²/25 + y²/9 = 1：轴方向、半轴、全轴、半焦距', () => {
    const k = makeKernel();
    // 旋转 0°：长轴沿 x（a=5, b=3, c=4）
    addInput(k, 'e: x^2/25 + y^2/9 = 1');
    addInput(k, 'ma = MajorAxis(e)');
    addInput(k, 'mi = MinorAxis(e)');
    addInput(k, 'sa = SemiMajorAxisLength(e)');
    addInput(k, 'sb = SemiMinorAxisLength(e)');
    addInput(k, 'fa = FirstAxisLength(e)');
    addInput(k, 'fb = SecondAxisLength(e)');
    addInput(k, 'c = LinearEccentricity(e)');
    // 长轴 = x 轴：方向 (1,0) → 法向 (0, ±1)，过原点 c=0
    const ma = findEl(k, GeoLine, 'ma');
    expect(ma.isDefined()).toBe(true);
    expect(Math.abs(ma.a)).toBeLessThan(EPS);
    expect(Math.abs(ma.c)).toBeLessThan(EPS);
    expect(Math.abs(ma.b)).toBeCloseTo(1, 9);
    // 短轴 = y 轴：方向 (0,1) → 法向 (±1, 0)
    const mi = findEl(k, GeoLine, 'mi');
    expect(Math.abs(mi.a)).toBeCloseTo(1, 9);
    expect(Math.abs(mi.b)).toBeLessThan(EPS);
    expect(findEl(k, GeoNumeric, 'sa').getValue()).toBeCloseTo(5, 9);
    expect(findEl(k, GeoNumeric, 'sb').getValue()).toBeCloseTo(3, 9);
    expect(findEl(k, GeoNumeric, 'fa').getValue()).toBeCloseTo(10, 9);
    expect(findEl(k, GeoNumeric, 'fb').getValue()).toBeCloseTo(6, 9);
    expect(findEl(k, GeoNumeric, 'c').getValue()).toBeCloseTo(4, 9);
  });

  it('双曲线 x²/4 − y²/9 = 1：半焦距 √(4+9) = √13、实轴 2a=4', () => {
    const k = makeKernel();
    addInput(k, 'h: x^2/4 - y^2/9 = 1');
    addInput(k, 'c = LinearEccentricity(h)');
    addInput(k, 'sa = SemiMajorAxisLength(h)');
    expect(findEl(k, GeoNumeric, 'c').getValue()).toBeCloseTo(Math.sqrt(13), 9);
    expect(findEl(k, GeoNumeric, 'sa').getValue()).toBeCloseTo(2, 9);
  });

  it('Sector(circle, A, B)：角度窗与扇形类型', () => {
    const k = makeKernel();
    addInput(k, 'c: x^2 + y^2 = 4');
    addInput(k, 'A = (2, 0)');
    addInput(k, 'B = (0, 2)');
    addInput(k, 'sec = Sector(c, A, B)');
    const sector = findEl(k, GeoConicPart, 'sec');
    expect(sector).toBeDefined();
    expect(sector.isDefined()).toBe(true);
    expect(sector.isSector()).toBe(true);
    // A(2,0) → θ=0，B(0,2) → θ=π/2，逆时针
    expect(sector.getStartAngle()).toBeCloseTo(0, 6);
    expect(sector.getEndAngle()).toBeCloseTo(Math.PI / 2, 6);
    expect(sector.isCounterClockwise()).toBe(true);
  });

  it('活依赖：Ellipse 点形式移动过点后半轴重算', () => {
    const k = makeKernel();
    addInput(k, 'F1 = (-4, 0)');
    addInput(k, 'F2 = (4, 0)');
    addInput(k, 'B = (5, 0)');
    addInput(k, 'ell = Ellipse(F1, F2, B)');
    addInput(k, 'sa = SemiMajorAxisLength(ell)');
    expect(findEl(k, GeoNumeric, 'sa').getValue()).toBeCloseTo(5, 6); // (|BF1|+|BF2|)/2 = (9+1)/2
    // 移动 B：a 跟随
    const b = findEl(k, GeoPoint, 'B') as GeoPoint;
    b.setCoords(0, 4);   // (|BF1|+|BF2|)/2 = (√32+√32)/2 = 4√2
    k.getConstruction().updateAllAlgorithms();
    expect(findEl(k, GeoNumeric, 'sa').getValue()).toBeCloseTo(4 * Math.SQRT2, 6);
  });
});

describe('L4-A7 文本命令族（官方 AlgoFractionText / AlgoTableText / ...）', () => {
  it('FractionText：连分数有理逼近（纯函数）', () => {
    expect(fractionText(0.5)).toBe('1/2');
    expect(fractionText(1.75)).toBe('7/4');
    expect(fractionText(1e-7)).toBe('1/10000000'); // 官方 1e-8 精度（此前 '0/1'）
    expect(fractionText(-1e-7)).toBe('-1/10000000');
    expect(fractionText(3)).toBe('3');
    {
      // √2：分母上限内的最佳有理逼近（不硬编码收敛子，验证逼近精度）
      const f = fractionText(Math.SQRT2);
      const [pStr, qStr] = f.split('/');
      expect(qStr).toBeDefined();
      expect(Math.abs(Number(pStr) / Number(qStr) - Math.SQRT2)).toBeLessThan(1.5e-8); // 官方精度 1e-8（相对量）
      expect(Number(qStr)).toBeLessThanOrEqual(1e9);
    }
  });

  it('ScientificText（纯函数）', () => {
    expect(scientificText(123400)).toBe('1.234×10^5');
    expect(scientificText(0.0025)).toBe('2.5×10^-3');
    expect(scientificText(0)).toBe('0');
  });

  it('FractionText/ScientificText 活算法：滑块拖动文本跟随', () => {
    const k = makeKernel();
    addInput(k, 'a = Slider(0, 2, 0.25)');
    addInput(k, 't1 = FractionText(a)');
    const t = findEl(k, GeoText, 't1');
    expect(t).toBeDefined();
    const a = findEl(k, GeoNumeric, 'a');
    a.setValue(1.75);
    k.getConstruction().updateAllAlgorithms();
    expect(t.text).toBe('7/4');
  });

  it('TableText/FormulaText/Name', () => {
    const k = makeKernel();
    addInput(k, 'row1 = {1, 2}');
    addInput(k, 'row2 = {3, 4}');
    addInput(k, 'tbl = TableText(row1, row2)');
    addInput(k, 'nm = Name(row1)');
    addInput(k, 'fm = FormulaText(row1)');
    expect(findEl(k, GeoText, 'tbl').text).toBe('1 & 2 \\\\ 3 & 4');
    expect(findEl(k, GeoText, 'nm').text).toBe('row1');
    expect(findEl(k, GeoText, 'fm').text).toContain('row1');
  });

  it('Split/TextToUnicode/UnicodeToText/LetterToUnicode/UnicodeToLetter', () => {
    const k = makeKernel();
    addInput(k, 'sp = Split("hello world")');
    addInput(k, 'codes = TextToUnicode("AB")');
    addInput(k, 'back = UnicodeToText(codes)');
    addInput(k, 'lu = LetterToUnicode("A")');
    addInput(k, 'ul = UnicodeToLetter(66)');
    const sp = findEl(k, GeoList, 'sp');
    const spTexts = sp.getChildren() as GeoText[];
    expect(spTexts.map(t => t.text)).toEqual(['hello', 'world']);
    const codes = findEl(k, GeoList, 'codes');
    expect((codes.getChildren() as GeoNumeric[]).map(c => c.getValue())).toEqual([65, 66]);
    expect(findEl(k, GeoText, 'back').text).toBe('AB');
    expect(findEl(k, GeoNumeric, 'lu').getValue()).toBe(65);
    expect(findEl(k, GeoText, 'ul').text).toBe('B');
  });
});

describe('序列化 roundtrip：圆锥属性/文本活算法', () => {
  it('FractionText 与 SemiMajorAxisLength 重建后活依赖保持', () => {
    const k = makeKernel();
    addInput(k, 'a = Slider(0, 2, 0.25)');
    addInput(k, 't = FractionText(a)');
    addInput(k, 'e: x^2/25 + y^2/9 = 1');
    addInput(k, 'sa = SemiMajorAxisLength(e)');
    const json = serialize(k);

    const k2 = makeKernel();
    deserialize(k2, json);
    k2.getConstruction().updateAllAlgorithms();
    const t2 = findEl(k2, GeoText, 't');
    const sa2 = findEl(k2, GeoNumeric, 'sa');
    expect(sa2.getValue()).toBeCloseTo(5, 9);
    const a2 = findEl(k2, GeoNumeric, 'a');
    a2.setValue(1.75);
    k2.getConstruction().updateAllAlgorithms();
    expect(t2.text).toBe('7/4');
  });
});
