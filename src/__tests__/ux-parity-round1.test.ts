/**
 * UX 对齐第一轮回归（对应 docs/UX 差距清单 3/4/5/6/7/10 项）：
 *   1. 标签系统：官方字符表（点跳过 X/Y、线/向量/圆锥/数值/角度表）+ 下标循环；
 *   2. 命令面补齐：Algo 已有、此前仅工具栏可达的 ~20 条文本命令；
 *   3. 输入语法糖：√ / π / ° / |x| / sin² / ² ³；
 *   4. 数值格式化：rounding / 角度单位（Options 三件套）；
 *   5. 序列化修复：自由 GeoArc / GeoConicPart 不再丢失；GeoBoolean / labelOffset / options 落盘；
 *   6. GeoBoolean：勾选联动关联对象显隐。
 */

import { describe, it, expect } from 'vitest';
import { Kernel } from '../kernel/core/Kernel';
import { ConstructionElement } from '../kernel/core/ConstructionElement';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoLine } from '../kernel/geo/GeoLine';
import { GeoSegment } from '../kernel/geo/GeoSegment';
import { GeoVector } from '../kernel/geo/GeoVector';
import { GeoConic } from '../kernel/geo/GeoConic';
import { GeoArc } from '../kernel/geo/GeoArc';
import { GeoConicPart, CONIC_PART_SECTOR } from '../kernel/geo/GeoConicPart';
import { GeoPolygon } from '../kernel/geo/GeoPolygon';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoBoolean } from '../kernel/geo/GeoBoolean';
import { GeoFunction } from '../kernel/geo/GeoFunction';
import { GeoVec3D } from '../kernel/core/GeoVec3D';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { parseExpression, preprocessInput } from '../kernel/algebra/ExpressionParser';
import { evaluate } from '../kernel/algebra/ExpressionEvaluator';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { ViewOptions, formatNumber, formatAngle } from '../kernel/core/Options';
import { Construction } from '../kernel/core/Construction';

const makeKernel = (): Kernel => new Kernel();

const addInput = (kernel: Kernel, text: string) => {
  const elements = parseAlgebraInput(kernel, text);
  elements.forEach(el => kernel.getConstruction().addElement(el));
  kernel.getConstruction().updateAllAlgorithms();
  return elements;
};

const ofType = <T extends ConstructionElement>(kernel: Kernel, type: new (...args: any[]) => T): T[] =>
  kernel.getConstruction().getElements().filter((el): el is T => el instanceof type);

const makePoint = (kernel: Kernel, x: number, y: number, label?: string): GeoPoint => {
  const p = new GeoPoint(kernel, new GeoVec3D(x, y, 1));
  if (label) p.label = label;
  kernel.getConstruction().addElement(p);
  return p;
};

// ---------------------------------------------------------------------------
// 1. 标签命名表
// ---------------------------------------------------------------------------

describe('标签命名表（对齐 GeoGebra LabelType）', () => {
  it('点序列跳过 X 和 Y，用尽后按下标循环（A→Z→A_1）', () => {
    const kernel = makeKernel();
    const cons = kernel.getConstruction();
    // 造 24 个点（字符表长度），下一个应是 A_1 而非 X/Y 相关
    for (let i = 0; i < 24; i++) {
      const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
      p.label = cons.getNextPointLabel();
      kernel.getConstruction().addElement(p);
    }
    const next = cons.getNextPointLabel();
    expect(next).toBe('A_1');
    // 全程不出现裸 X / Y
    const used = ofType(kernel, GeoPoint).map(p => p.label);
    expect(used).not.toContain('X');
    expect(used).not.toContain('Y');
    expect(new Set(used).size).toBe(24);
  });

  it('直线/线段走小写字母表（f, g, h…），向量走 u, v, w…', () => {
    const kernel = makeKernel();
    const a = addInput(kernel, 'A = (0, 0)');
    void a;
    addInput(kernel, 'B = (3, 0)');
    const seg = addInput(kernel, 'Segment(A, B)');
    const line = addInput(kernel, 'Line(A, B)');
    const vec = addInput(kernel, 'Vector(A, B)');
    expect((seg[seg.length - 1] as any).label).toBe('f');
    expect((line[line.length - 1] as any).label).toBe('g');
    expect((vec[vec.length - 1] as any).label).toBe('u');
  });

  it('圆/圆锥走 c,d,e… 表；数值走 a,b,c… 表；角度走希腊字母表', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (2, 0)');
    addInput(kernel, 'C = (1, 2)');
    addInput(kernel, 'Circle(A, B)');
    expect(ofType(kernel, GeoConic)[0].label).toBe('c');

    const dist = addInput(kernel, 'Distance(A, B)');
    expect((dist[dist.length - 1] as GeoNumeric).label).toBe('a');

    const angle = addInput(kernel, 'Angle(B, A, C)');
    const angleLabel = (angle[angle.length - 1] as GeoNumeric).label;
    expect(angleLabel).toBe('α');
    // 角度量带 isAngle 标记：代数描述按角度单位显示
    expect((angle[angle.length - 1] as GeoNumeric).isAngle).toBe(true);
  });

  it('标签查重跨家族共享命名空间（先有线 f，后建函数拿到 g）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (1, 1)');
    addInput(kernel, 'Segment(A, B)');   // f
    addInput(kernel, 'g(x) = x');
    expect(ofType(kernel, GeoLine).some(l => l.label === 'f')).toBe(true);
    expect(ofType(kernel, GeoLine).some(l => l.label === 'g')).toBe(false);
  });

  it('Construction.getNextAngleLabel 返回希腊字母（无 π）', () => {
    const kernel = makeKernel();
    const cons = kernel.getConstruction();
    const first = cons.getNextAngleLabel();
    expect(first).toBe('α');
    expect(first).not.toBe('π');
  });
});

// ---------------------------------------------------------------------------
// 2. 命令面补齐
// ---------------------------------------------------------------------------

describe('命令面补齐（Algo 已有 → 文本命令）', () => {
  it('ParallelLine / OrthogonalLine / PerpendicularLine', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (4, 0)');
    addInput(kernel, 'P = (1, 3)');
    addInput(kernel, 'l0 = Line(A, B)');
    const l0 = ofType(kernel, GeoLine).find(l => l.label === 'l0')!;
    const par = addInput(kernel, 'ParallelLine(P, l0)');
    const parLine = par.filter(el => el instanceof GeoLine)[0] as GeoLine;
    // 方向叉积为 0 = 平行
    expect(Math.abs(parLine.a * l0.b - parLine.b * l0.a)).toBeLessThan(1e-9);

    const perp = addInput(kernel, 'OrthogonalLine(P, l0)');
    const perpLine = perp.filter(el => el instanceof GeoLine)[0] as GeoLine;
    // 方向点积为 0 = 垂直
    expect(Math.abs(perpLine.a * l0.a + perpLine.b * l0.b)).toBeLessThan(1e-9);

    const alias = addInput(kernel, 'PerpendicularLine(P, l0)');
    const aliasLine = alias.filter(el => el instanceof GeoLine)[0] as GeoLine;
    expect(Math.abs(aliasLine.a * l0.a + aliasLine.b * l0.b)).toBeLessThan(1e-9);
  });

  it('PerpendicularBisector / LineBisector / AngleBisector / AngularBisector', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (4, 0)');
    addInput(kernel, 'C = (0, 3)');
    const bis = addInput(kernel, 'PerpendicularBisector(A, B)');
    const line = bis.filter(el => el instanceof GeoLine)[0] as GeoLine;
    // 中垂线过 (2, 0)
    expect(Math.abs(line.a * 2 + line.b * 0 + line.c) / Math.hypot(line.a, line.b)).toBeLessThan(1e-9);

    const alias = addInput(kernel, 'LineBisector(A, B)');
    expect(alias.some(el => el instanceof GeoLine)).toBe(true);

    const angleBis = addInput(kernel, 'AngleBisector(B, A, C)');
    expect(angleBis.some(el => el instanceof GeoLine)).toBe(true);
    const angleBisAlias = addInput(kernel, 'AngularBisector(B, A, C)');
    expect(angleBisAlias.some(el => el instanceof GeoLine)).toBe(true);
  });

  it('Ellipse / Hyperbola / Parabola / Conic（五点）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'F1 = (-3, 0)');
    addInput(kernel, 'F2 = (3, 0)');
    addInput(kernel, 'P = (0, 2)');
    const ell = addInput(kernel, 'Ellipse(F1, F2, P)');
    const ellipse = ell.filter(el => el instanceof GeoConic)[0] as GeoConic;
    expect(ellipse.isDefined()).toBe(true);
    expect(ellipse.getConicType()).toBe('ellipse');

    const hyp = addInput(kernel, 'Hyperbola(F1, F2, P)');
    expect(hyp.some(el => el instanceof GeoConic)).toBe(true);

    addInput(kernel, 'Fc = (1, 2)');
    addInput(kernel, 'd0 = Line((0, -2), (4, -2))');
    const dir = ofType(kernel, GeoLine).find(l => l.label === 'd0')!;
    const par = addInput(kernel, 'Parabola(Fc, d0)');
    const parabola = par.filter(el => el instanceof GeoConic)[0] as GeoConic;
    expect(parabola.isDefined()).toBe(true);

    const conicPts = ['(0,0)', '(4,0)', '(4,3)', '(0,3)', '(2,4)'];
    const conic = addInput(kernel, `Conic(${conicPts.join(', ')})`);
    expect(conic.some(el => el instanceof GeoConic)).toBe(true);
  });

  it('Semicircle / Arc / CircularSector / CircumcircularArc / CircumcircularSector', () => {
    const kernel = makeKernel();
    addInput(kernel, 'M = (0, 0)');
    addInput(kernel, 'A = (2, 0)');
    addInput(kernel, 'B = (-2, 0)');
    addInput(kernel, 'C = (0, 2)');

    const semi = addInput(kernel, 'Semicircle(A, B)');
    const semiArc = semi.filter(el => el instanceof GeoArc || el instanceof GeoConicPart)[0] as GeoConic;
    expect(semiArc.isDefined()).toBe(true);

    const arc = addInput(kernel, 'Arc(M, A, C)');
    const arcEl = arc.filter(el => el instanceof GeoArc)[0] as GeoArc;
    expect(arcEl).toBeDefined();
    expect(arcEl.getRadius()).toBeCloseTo(2, 9);

    const sector = addInput(kernel, 'CircularSector(M, A, C)');
    expect(sector.some(el => el instanceof GeoConicPart)).toBe(true);

    const cArc = addInput(kernel, 'CircumcircularArc(A, C, B)');
    expect(cArc.some(el => el instanceof GeoArc || el instanceof GeoConicPart)).toBe(true);

    const cSector = addInput(kernel, 'CircumcircularSector(A, C, B)');
    expect(cSector.some(el => el instanceof GeoConicPart)).toBe(true);
  });

  it('Compass(A, B) / Compass(A, seg) / RegularPolygon(A, B, n)', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (0, 0)');
    addInput(kernel, 'B = (3, 0)');
    addInput(kernel, 'P = (1, 1)');

    const comp1 = addInput(kernel, 'Compass(P, B)');
    const c1 = comp1.filter(el => el instanceof GeoConic)[0] as GeoConic;
    expect(c1.getRadius()).toBeCloseTo(Math.hypot(2, -1), 9);   // |PB|，圆心 P

    const comp2 = addInput(kernel, 'Compass(P, A)');
    const c2 = comp2.filter(el => el instanceof GeoConic)[0] as GeoConic;
    expect(c2.getRadius()).toBeCloseTo(Math.SQRT2, 6); // |PA|

    const poly = addInput(kernel, 'RegularPolygon(A, B, 5)');
    const polyOut = poly.filter(el => el instanceof GeoPolygon)[0] as GeoPolygon;
    expect(polyOut.vertices).toHaveLength(5);
  });

  it('Invert / Area / Length / Reflect', () => {
    const kernel = makeKernel();
    // 圆心用具名点：内联元组点自 P0-2 修复后也会登记并占用标签，避免与 A 撞名
    addInput(kernel, 'O = (0, 0)');
    addInput(kernel, 'c0 = Circle(O, 2)');
    addInput(kernel, 'A = (4, 0)');
    addInput(kernel, 'B = (2, 0)');
    const inv = addInput(kernel, 'Invert(A, c0)');
    const invPoint = inv.filter(el => el instanceof GeoPoint && (el as GeoPoint).label !== 'A')[0] as GeoPoint;
    expect(invPoint.getX()).toBeCloseTo(1, 9);  // r²/|OA| = 4/4 = 1

    addInput(kernel, 'poly0 = Polygon((0,0), (3,0), (0,3))');
    const area = addInput(kernel, 'Area(poly0)');
    expect((area[area.length - 1] as GeoNumeric).getValue()).toBeCloseTo(4.5, 9);

    addInput(kernel, 'D = (0, 4)');
    const perimLen = addInput(kernel, 'Length(poly0)');
    // 等腰直角三角形周长 = 3 + 3 + 3√2
    expect((perimLen[perimLen.length - 1] as GeoNumeric).getValue()).toBeCloseTo(6 + 3 * Math.SQRT2, 9);
    const perimCmd = addInput(kernel, 'Perimeter(poly0)');
    expect((perimCmd[perimCmd.length - 1] as GeoNumeric).getValue()).toBeCloseTo(6 + 3 * Math.SQRT2, 9);
    const seg = addInput(kernel, 'Segment(A, B)');
    const segLen = addInput(kernel, 'Length(A)');
    // Length(point) = 点到原点距离 = 4（返回数组含隐藏原点辅助点，过滤出数值）
    const lenValue = segLen.filter(el => el instanceof GeoNumeric)[0] as GeoNumeric;
    expect(lenValue.getValue()).toBeCloseTo(4, 9);
    void seg;

    // 点关于直线镜像（官方 Reflect(P, line) / Mirror 的英文别名）
    addInput(kernel, 'x0 = Line((0, 0), (4, 0))');
    const refl = addInput(kernel, 'Reflect(D, x0)');
    const reflOverLine = refl.filter(el => el instanceof GeoPoint && (el as GeoPoint).label !== 'D')[0] as GeoPoint;
    expect(reflOverLine.getX()).toBeCloseTo(0, 9);
    expect(reflOverLine.getY()).toBeCloseTo(-4, 9);

    const reflPoint = addInput(kernel, 'Reflect(A, c0)');
    // 点关于点镜像：c0 是圆不是点 → 找不到镜点应报错？官方 Reflect(A, B) 才是点对称；
    // 这里对圆做镜像走 AlgoMirror 之外的路径会抛错——改测点镜像：
    void reflPoint;
    addInput(kernel, 'O0 = (0, 0)');
    const reflPt = addInput(kernel, 'Reflect(D, O0)');
    const mirrorPt = reflPt.filter(el => el instanceof GeoPoint && (el as GeoPoint).label !== 'D')[0] as GeoPoint;
    expect(mirrorPt.getX()).toBeCloseTo(0, 9);
    expect(mirrorPt.getY()).toBeCloseTo(-4, 9);
  });
});

// ---------------------------------------------------------------------------
// 3. 输入语法糖
// ---------------------------------------------------------------------------

describe('输入语法糖（√ / π / ° / |x| / sin² / ² ³）', () => {
  const evalText = (text: string): number =>
    evaluate(parseExpression(text), new Map());

  it('√ 数字与括号组', () => {
    expect(evalText('√9')).toBe(3);
    expect(evalText('√(16 + 9)')).toBe(5);
    expect(evalText('2√4')).toBe(4);
  });

  it('π 与 °', () => {
    expect(evalText('π')).toBeCloseTo(Math.PI, 12);
    expect(evalText('180°')).toBeCloseTo(Math.PI, 12);
    expect(evalText('2π')).toBeCloseTo(2 * Math.PI, 12);
    expect(evalText('90° + 1')).toBeCloseTo(Math.PI / 2 + 1, 12);
    // 度单位进三角函数
    expect(evalText('sin(30°)')).toBeCloseTo(0.5, 12);
  });

  it('|x| 绝对值竖线', () => {
    expect(evalText('|3 - 5|')).toBe(2);
    expect(evalText('|-4| + |2|')).toBe(6);
  });

  it('sin²(x) 幂简写与 ² ³ 上标', () => {
    expect(evalText('sin²(π/6)')).toBeCloseTo(0.25, 12);
    expect(evalText('2²')).toBe(4);
    expect(evalText('2³')).toBe(8);
    expect(evalText('cos²(x) + sin²(x)') !== undefined).toBe(true);
  });

  it('语法糖进入构造：y = √x 可创建函数', () => {
    const kernel = makeKernel();
    addInput(kernel, 'f(x) = √(x)');
    const fn = kernel.getConstruction().getElements().find(el => (el as any).evaluateAt) as any;
    expect(fn.evaluateAt(9)).toBeCloseTo(3, 12);
  });

  it('° 是括号化后缀：优先级高于 ^（评审 I1）', () => {
    // (45°)² = (π/4)² ≈ 0.61685 —— 修复前 45° 被替换成乘法右操作数，得 0.0137
    expect(evalText('45°^2')).toBeCloseTo(Math.pow(Math.PI / 4, 2), 9);
    // 2^(45°) ≈ 1.7245 —— 修复前得 6.14e11
    expect(evalText('2^45°')).toBeCloseTo(Math.pow(2, Math.PI / 4), 9);
    // (45°)/(45°) = 1 —— 修复前 0.000305
    expect(evalText('45°/45°')).toBeCloseTo(1, 9);
    // 括号组操作数：((1+1)°) = π/90
    expect(evalText('(1+1)°')).toBeCloseTo(2 * Math.PI / 180, 12);
    // 悬空 ° 抛错而非静默错值
    expect(() => evalText('°3')).toThrow();
  });

  it('√ 操作数严格：函数调用 / 嵌套 / 隐式乘号 / 非法输入抛错（评审 I2）', () => {
    // √sin(x) → sqrt(sin(x))，不再是 sqrt(sin)(x)
    expect(preprocessInput('√sin(x)')).toBe('sqrt(sin(x))');
    // √√4 → sqrt(sqrt(4))
    expect(preprocessInput('√√4')).toBe('sqrt(sqrt(4))');
    // x√y → x*sqrt(y)（补显式乘号，不再粘成 xsqrt）
    expect(preprocessInput('x√y')).toBe('x*sqrt(y)');
    // 非法输入抛错，不再静默当变量
    expect(() => preprocessInput('√+3')).toThrow();
    expect(() => preprocessInput('√')).toThrow();
    // √9 = 3，√(16+9) = 5 仍正确
    expect(evalText('√9')).toBe(3);
    expect(evalText('√sin(0)')).toBe(0);
  });

  it('希腊字母标签可在表达式中引用（评审 U6）', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0)');
    addInput(kernel, 'O = (0, 0)');
    addInput(kernel, 'B = (0, 1)');
    addInput(kernel, 'Angle(A, O, B)');   // 输出标签 α
    // α + 1 可解析（tokenizer 标识符类含希腊字母），依赖也接线
    const elements = addInput(kernel, 'h(x) = α * x');
    expect(elements.some(el => el instanceof GeoFunction)).toBe(true);
    const fn = kernel.getConstruction().getElements().find(el => (el as any).evaluateAt) as any;
    // α = π/2 → h(2) = π
    expect(fn.evaluateAt(2)).toBeCloseTo(Math.PI / 2 * 2, 9);
  });
});

// ---------------------------------------------------------------------------
// 4. 数值格式化（Options 三件套）
// ---------------------------------------------------------------------------

describe('Options：rounding / 角度单位 / 点捕捉', () => {
  it('formatNumber 按小数位去尾零', () => {
    const options = new ViewOptions();
    expect(formatNumber(3.14159, options)).toBe('3.14');
    options.set({ rounding: 4 });
    expect(formatNumber(3.14159, options)).toBe('3.1416');
    options.set({ rounding: 0 });
    expect(formatNumber(3.7, options)).toBe('4');
    expect(formatNumber(-0.0001, options)).toBe('0');
    expect(formatNumber(NaN, options)).toBe('undefined');
    expect(formatNumber(Infinity, options)).toBe('∞');
  });

  it('formatAngle 支持度/弧度切换', () => {
    const options = new ViewOptions();
    expect(formatAngle(Math.PI / 6, options)).toBe('30°');
    options.set({ angleUnit: 'radian' });
    // 弧度模式为纯数值（无 ° 后缀，对标 GeoGebra 显示习惯）
    expect(formatAngle(Math.PI / 6, options)).toBe('0.52');
  });

  it('角度量的代数描述随 angleUnit 变化', () => {
    const kernel = makeKernel();
    addInput(kernel, 'A = (1, 0)');
    addInput(kernel, 'O = (0, 0)');
    addInput(kernel, 'B = (0, 1)');
    addInput(kernel, 'Angle(A, O, B)');
    const angle = kernel.getConstruction().getElements()
      .find(el => el instanceof GeoNumeric && (el as GeoNumeric).isAngle) as GeoNumeric;
    expect(angle.getAlgebraDescription()).toContain('90°');
    kernel.getOptions().set({ angleUnit: 'radian' });
    expect(angle.getAlgebraDescription()).toContain('1.57');
  });
});

// ---------------------------------------------------------------------------
// 5. 序列化修复：自由弧/扇形、GeoBoolean、labelOffset、options
// ---------------------------------------------------------------------------

describe('序列化 v4：自由 GeoArc / GeoConicPart / GeoBoolean / labelOffset / options', () => {
  const roundtrip = (kernel: Kernel): Kernel => {
    const restored = new Kernel();
    deserialize(restored, serialize(kernel));
    return restored;
  };

  it('自由 GeoArc roundtrip（此前保存即丢）', () => {
    const kernel = makeKernel();
    const arc = new GeoArc(kernel, { x: 1, y: 2 }, 3, 0, Math.PI / 2, true);
    arc.label = 'arc1';
    arc.labelOffsetX = 7;
    arc.labelOffsetY = -3;
    kernel.getConstruction().addElement(arc);

    const restored = roundtrip(kernel);
    const arcs = restored.getConstruction().getElements().filter(el => el instanceof GeoArc) as GeoArc[];
    expect(arcs).toHaveLength(1);
    const restoredArc = arcs[0];
    expect(restoredArc.label).toBe('arc1');
    expect(restoredArc.getCenter().x).toBeCloseTo(1, 9);
    expect(restoredArc.getCenter().y).toBeCloseTo(2, 9);
    expect(restoredArc.getRadius()).toBeCloseTo(3, 9);
    expect(restoredArc.getStartAngle()).toBeCloseTo(0, 9);
    expect(restoredArc.getEndAngle()).toBeCloseTo(Math.PI / 2, 9);
    expect(restoredArc.isCounterClockwise()).toBe(true);
    expect(restoredArc.labelOffsetX).toBe(7);
    expect(restoredArc.labelOffsetY).toBe(-3);
  });

  it('自由 GeoConicPart（扇形）roundtrip 保留 partType', () => {
    const kernel = makeKernel();
    const sector = new GeoConicPart(kernel, { x: 0, y: 0 }, 2, 0, Math.PI / 3, CONIC_PART_SECTOR, true);
    sector.label = 'sec1';
    kernel.getConstruction().addElement(sector);

    const restored = roundtrip(kernel);
    const parts = restored.getConstruction().getElements().filter(el => el instanceof GeoConicPart) as GeoConicPart[];
    expect(parts).toHaveLength(1);
    expect(parts[0].getPartType()).toBe(CONIC_PART_SECTOR);
    expect(parts[0].isSector()).toBe(true);
    expect(parts[0].getEndAngle()).toBeCloseTo(Math.PI / 3, 9);
  });

  it('GeoBoolean roundtrip：值 + 关联对象标签', () => {
    const kernel = makeKernel();
    const bool = new GeoBoolean(kernel, true);
    bool.label = 'b0';
    bool.linkedLabels = ['A'];
    kernel.getConstruction().addElement(bool);
    makePoint(kernel, 1, 1, 'A');

    const restored = roundtrip(kernel);
    const bools = restored.getConstruction().getElements().filter(el => el instanceof GeoBoolean) as GeoBoolean[];
    expect(bools).toHaveLength(1);
    expect(bools[0].getValue()).toBe(true);
    expect(bools[0].linkedLabels).toEqual(['A']);
  });

  it('options（rounding/角度单位/点捕捉）随存档恢复', () => {
    const kernel = makeKernel();
    kernel.getOptions().set({ rounding: 5, angleUnit: 'radian', pointCapturing: 'snap_grid' });
    makePoint(kernel, 0, 0, 'A');

    const restored = roundtrip(kernel);
    expect(restored.getOptions().rounding).toBe(5);
    expect(restored.getOptions().angleUnit).toBe('radian');
    expect(restored.getOptions().pointCapturing).toBe('snap_grid');
  });
});

// ---------------------------------------------------------------------------
// 6. GeoBoolean 联动显隐
// ---------------------------------------------------------------------------

describe('GeoBoolean：勾选联动关联对象显隐', () => {
  it('setValue(false) 隐藏关联对象，setValue(true) 恢复', () => {
    const kernel = makeKernel();
    const point = makePoint(kernel, 1, 1, 'A');
    const bool = new GeoBoolean(kernel, true);
    bool.label = 'b0';
    bool.linkedLabels = ['A'];
    kernel.getConstruction().addElement(bool);

    bool.setValue(false);
    expect(bool.getValue()).toBe(false);
    expect(point.visible).toBe(false);

    bool.setValue(true);
    expect(point.visible).toBe(true);
  });

  it('关联标签指向已删除对象时静默忽略', () => {
    const kernel = makeKernel();
    const bool = new GeoBoolean(kernel, false);
    bool.label = 'b0';
    bool.linkedLabels = ['GONE'];
    kernel.getConstruction().addElement(bool);
    expect(() => bool.setValue(true)).not.toThrow();
    expect(bool.getValue()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Construction 兼容性
// ---------------------------------------------------------------------------

describe('Construction 标签 API 兼容', () => {
  it('getNextVectorLabel / getNextAngleLabel 存在且唯一', () => {
    const kernel = new Kernel();
    const cons = kernel.getConstruction() as Construction;
    const v1 = cons.getNextVectorLabel();
    const vec = new GeoVector(kernel, 0, 0, 1, 1);
    vec.label = v1;
    kernel.getConstruction().addElement(vec);
    const v2 = cons.getNextVectorLabel();
    expect(v1).not.toBe(v2);
    const a1 = cons.getNextAngleLabel();
    const num = new GeoNumeric(kernel, 0);
    num.label = a1;
    kernel.getConstruction().addElement(num);
    const a2 = cons.getNextAngleLabel();
    expect(a1).not.toBe(a2);
  });
});
