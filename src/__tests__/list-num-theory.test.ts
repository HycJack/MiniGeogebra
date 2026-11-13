/**
 * 列表命令族 + 数论命令族回归（L4/F2-4，官方 AlgoSequence/AlgoGCD 等对齐）：
 * Sequence 活依赖、Element/First/Last/Take/Sort/Unique/Reverse/Append/Insert/
 * Remove/RemoveUndefined/Flatten/Join/Sum/Product/IndexOf、
 * GCD/LCM/Mod/Div/IsPrime/NextPrime/PreviousPrime/PrimeFactors/DivisorsList/
 * DivisorsSum/BinomialCoefficient/ToBase/FromBase、序列化 roundtrip。
 */
import { describe, it, expect } from 'vitest';
import { makeKernel, makePoint, EPS } from './helpers';
import { parseAlgebraInput } from '../kernel/algebra/EquationRecognizer';
import { serialize, deserialize } from '../kernel/persistence/ConstructionSerializer';
import { GeoList } from '../kernel/geo/GeoList';
import { GeoNumeric } from '../kernel/geo/GeoNumeric';
import { GeoPoint } from '../kernel/geo/GeoPoint';
import { GeoText } from '../kernel/geo/GeoText';

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

const numValues = (list: GeoList): number[] =>
  list.getChildren().map(c => (c as GeoNumeric).getValue());

describe('L4-A1 数论命令族（官方 AlgoGCD/AlgoMod/...）', () => {
  it('GCD/LCM/Mod/Div：基本算术', () => {
    const k = makeKernel();
    addInput(k, 'g = GCD(12, 18)');
    addInput(k, 'l = LCM(4, 6)');
    addInput(k, 'm = Mod(7, 3)');
    addInput(k, 'd = Div(7, 2)');
    expect(findEl(k, GeoNumeric, 'g').getValue()).toBe(6);
    expect(findEl(k, GeoNumeric, 'l').getValue()).toBe(12);
    expect(findEl(k, GeoNumeric, 'm').getValue()).toBe(1);
    expect(findEl(k, GeoNumeric, 'd').getValue()).toBe(3);
  });

  it('IsPrime/NextPrime/PreviousPrime/DivisorsSum/BinomialCoefficient', () => {
    const k = makeKernel();
    addInput(k, 'p1 = IsPrime(17)');
    addInput(k, 'p2 = IsPrime(18)');
    addInput(k, 'np = NextPrime(10)');
    addInput(k, 'pp = PreviousPrime(10)');
    addInput(k, 'ds = DivisorsSum(12)');
    addInput(k, 'bc = BinomialCoefficient(5, 2)');
    expect(findEl(k, GeoNumeric, 'p1').getValue()).toBe(1);
    expect(findEl(k, GeoNumeric, 'p2').getValue()).toBe(0);
    expect(findEl(k, GeoNumeric, 'np').getValue()).toBe(11);
    expect(findEl(k, GeoNumeric, 'pp').getValue()).toBe(7);
    expect(findEl(k, GeoNumeric, 'ds').getValue()).toBe(28);   // 1+2+3+4+6+12
    expect(findEl(k, GeoNumeric, 'bc').getValue()).toBe(10);
  });

  it('PrimeFactors/DivisorsList：素因数带重复、约数升序；活依赖随输入重算', () => {
    const k = makeKernel();
    addInput(k, 'n = 12');
    addInput(k, 'pf = PrimeFactors(n)');
    addInput(k, 'dl = DivisorsList(n)');
    const pf = findEl(k, GeoList, 'pf');
    const dl = findEl(k, GeoList, 'dl');
    expect(numValues(pf)).toEqual([2, 2, 3]);
    expect(numValues(dl)).toEqual([1, 2, 3, 4, 6, 12]);
    // 活依赖：n → 18，重算
    const n = findEl(k, GeoNumeric, 'n');
    n.setValue(18);
    k.getConstruction().updateAllAlgorithms();
    expect(numValues(pf)).toEqual([2, 3, 3]);
    expect(numValues(dl)).toEqual([1, 2, 3, 6, 9, 18]);
  });

  it('ToBase/FromBase：进制往返', () => {
    const k = makeKernel();
    addInput(k, 't1 = ToBase(255, 16)');
    addInput(k, 't2 = FromBase("FF", 16)');
    expect(findEl(k, GeoText, 't1').text).toBe('FF');
    expect(findEl(k, GeoNumeric, 't2').getValue()).toBe(255);
  });
});

describe('L4/F2-4 列表命令族（官方 AlgoSequence/AlgoElementList/...）', () => {
  it('Sequence 活依赖：表达式 + 区间端点，滑块拖动整表跟随', () => {
    const k = makeKernel();
    addInput(k, 'c = Slider(1, 5, 1)');
    addInput(k, 'lst = Sequence(k^2, k, 1, c)');
    const list = findEl(k, GeoList, 'lst');
    const cSlider = findEl(k, GeoNumeric, 'c');
    cSlider.setValue(5);
    k.getConstruction().updateAllAlgorithms();
    expect(numValues(list)).toEqual([1, 4, 9, 16, 25]);
    // 活依赖：c → 3
    const c = findEl(k, GeoNumeric, 'c');
    c.setValue(3);
    k.getConstruction().updateAllAlgorithms();
    expect(numValues(list)).toEqual([1, 4, 9]);
  });

  it('Element/First/Last/Take：索引与切片', () => {
    const k = makeKernel();
    addInput(k, 'lst = Sequence(2k - 1, k, 1, 5)');   // {1,3,5,7,9}
    addInput(k, 'e2 = Element(lst, 2)');
    addInput(k, 'f1 = First(lst)');
    addInput(k, 'l1 = Last(lst)');
    addInput(k, 'tk = Take(lst, 2, 4)');
    expect(findEl(k, GeoNumeric, 'e2').getValue()).toBe(3);
    expect(findEl(k, GeoNumeric, 'f1').getValue()).toBe(1);
    expect(findEl(k, GeoNumeric, 'l1').getValue()).toBe(9);
    expect(numValues(findEl(k, GeoList, 'tk'))).toEqual([3, 5, 7]);
  });

  it('Sort/Unique/Reverse：变换族', () => {
    const k = makeKernel();
    addInput(k, 'src = {5, 1, 5, 3}');
    addInput(k, 'srt = Sort(src)');
    addInput(k, 'unq = Unique(src)');
    addInput(k, 'rev = Reverse(src)');
    expect(numValues(findEl(k, GeoList, 'srt'))).toEqual([1, 3, 5, 5]);
    expect(numValues(findEl(k, GeoList, 'unq'))).toEqual([5, 1, 3]);
    expect(numValues(findEl(k, GeoList, 'rev'))).toEqual([3, 5, 1, 5]);
  });

  it('Append/Insert/Remove：增删', () => {
    const k = makeKernel();
    addInput(k, 'src = {1, 2, 3}');
    addInput(k, 'ap = Append(src, 4)');
    addInput(k, 'ins = Insert(src, 0, 1)');
    addInput(k, 'rm = Remove(src, 2)');
    expect(numValues(findEl(k, GeoList, 'ap'))).toEqual([1, 2, 3, 4]);
    expect(numValues(findEl(k, GeoList, 'ins'))).toEqual([0, 1, 2, 3]);
    expect(numValues(findEl(k, GeoList, 'rm'))).toEqual([1, 3]);
  });

  it('Sum/Product/IndexOf/RemoveUndefined/Flatten/Join', () => {
    const k = makeKernel();
    addInput(k, 'lst = Sequence(k, k, 1, 4)');
    addInput(k, 's = Sum(lst)');
    addInput(k, 'p = Product(lst)');
    addInput(k, 'ix = IndexOf(lst, 3)');
    addInput(k, 'withU = {1, 2, 3}');
    addInput(k, 'nested = {lst, lst}');
    addInput(k, 'fl = Flatten(nested)');
    expect(findEl(k, GeoNumeric, 's').getValue()).toBe(10);
    expect(findEl(k, GeoNumeric, 'p').getValue()).toBe(24);
    expect(findEl(k, GeoNumeric, 'ix').getValue()).toBe(3);
    addInput(k, 'miss = IndexOf(lst, 99)');
    // 官方 AlgoIndexOf：未找到保持 undefined（此前输出 0）
    expect(findEl(k, GeoNumeric, 'miss').isDefined()).toBe(false);
    expect(numValues(findEl(k, GeoList, 'fl'))).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });

  it('点列表：Element 出点、Sort 按 x、IndexOf 认点', () => {
    const k = makeKernel();
    makePoint(k, 3, 1, 'P1');
    makePoint(k, 1, 2, 'P2');
    addInput(k, 'pl = {P1, P2}');
    addInput(k, 'srt = Sort(pl)');
    addInput(k, 'first = Element(pl, 1)');
    addInput(k, 'ix = IndexOf(pl, P2)');
    const srt = findEl(k, GeoList, 'srt');
    const kids = srt.getChildren() as GeoPoint[];
    expect(kids[0].getX()).toBe(1);   // P2 在前
    const first = findEl(k, GeoPoint, 'first');
    expect(first).toBeDefined();
    expect(first.getX()).toBe(3);
    expect(findEl(k, GeoNumeric, 'ix').getValue()).toBe(2);
  });

  it('正 n 边形族基石：Sequence + Element 组合出顶点坐标', () => {
    const k = makeKernel();
    addInput(k, 'n = 6');
    addInput(k, 'xs = Sequence(cos(2 pi k / n), k, 1, n)');
    addInput(k, 'x1 = Element(xs, 1)');
    // cos(2π/6) = 0.5
    expect(findEl(k, GeoNumeric, 'x1').getValue()).toBeCloseTo(0.5, 6);
  });
});

describe('序列化 roundtrip：列表/数论算法', () => {
  it('Sequence/PrimeFactors/Sort 全链路重建（自有子元素由算法重算回填）', () => {
    const k = makeKernel();
    addInput(k, 'c = Slider(1, 5, 1)');
    addInput(k, 'lst = Sequence(k^2, k, 1, c)');
    addInput(k, 'pf = PrimeFactors(12)');
    addInput(k, 'srt = Sort(lst)');
    const json = serialize(k);

    const k2 = makeKernel();
    deserialize(k2, json);
    k2.getConstruction().updateAllAlgorithms();
    const lst2 = findEl(k2, GeoList, 'lst');
    const pf2 = findEl(k2, GeoList, 'pf');
    const srt2 = findEl(k2, GeoList, 'srt');
    expect(lst2).toBeDefined();
    // 滑块初值随存档往返；显式置 5 后整表跟随
    const c2 = findEl(k2, GeoNumeric, 'c');
    c2.setValue(5);
    k2.getConstruction().updateAllAlgorithms();
    expect(numValues(lst2)).toEqual([1, 4, 9, 16, 25]);
    expect(numValues(pf2)).toEqual([2, 2, 3]);
    expect(numValues(srt2)).toEqual([1, 4, 9, 16, 25]);
    // 重建后活依赖保持：c → 2
    c2.setValue(2);
    k2.getConstruction().updateAllAlgorithms();
    expect(numValues(lst2)).toEqual([1, 4]);
  });
});
