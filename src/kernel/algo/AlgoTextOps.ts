/**
 * 文本命令族（对标官方 AlgoFractionText / AlgoScientificText / AlgoTableText /
 * AlgoFormulaText / AlgoName / AlgoSplit / AlgoTextToUnicode / AlgoUnicodeToText /
 * AlgoLetterToUnicode / AlgoUnicodeToLetter）。
 *
 * FractionText/ScientificText 为活算法（数值滑块拖动文本跟随）；其余静态求值。
 * 未做（需渲染器旋转变更/根式探测）：SurdText、VerticalText、RotateText。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoText } from '../geo/GeoText';
import { GeoList } from '../geo/GeoList';

/** 有理逼近 → "p/q" 文本（连分数展开，分母上限 10⁶；整数原样；非有限 → '?'）。 */
export function fractionText(value: number): string {
  if (!Number.isFinite(value)) return '?';
  if (Number.isInteger(value)) return String(value);
  const sign = value < 0 ? '-' : '';
  const target = Math.abs(value);
  // 连分数展开 + 逐收敛子检验：分母超限或相对误差达标即停
  //（无理数如 √2 的双精度展开会一路走到浮点噪声的"精确分数"，必须在 q 上限截断）
  let x = target;
  let prevP = 1;
  let prevQ = 0;
  let curP = Math.floor(x);
  let curQ = 1;
  let best = { p: curP, q: 1 };
  for (let i = 0; i < 40; i++) {
    // 当前收敛子达标 → 采用
    if (Math.abs(target - curP / curQ) < 1e-12 * Math.max(1, target)) {
      best = { p: curP, q: curQ };
      break;
    }
    const frac = x - Math.floor(x);
    if (frac < 1e-12) break; // 有限展开结束
    x = 1 / frac;
    const term = Math.floor(x);
    const nextP = term * curP + prevP;
    const nextQ = term * curQ + prevQ;
    if (nextQ > 1e6) break;  // 分母上限：保留上一收敛子
    prevP = curP; prevQ = curQ;
    curP = nextP; curQ = nextQ;
    best = { p: curP, q: curQ };
  }
  if (best.q === 0) return sign + String(value);
  return `${sign}${best.p}/${best.q}`;
}

/** 科学计数文本："1.234×10⁵"（4 位有效数字；指数负数用 −）。 */
export function scientificText(value: number): string {
  if (!Number.isFinite(value)) return '?';
  if (value === 0) return '0';
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / Math.pow(10, exponent);
  const mantissaStr = mantissa.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return `${mantissaStr}×10^${exponent}`;
}

/** 活文本基类：数值输入（滑块活引用）→ 文本输出。 */
abstract class AlgoLiveText extends AlgoElement {
  protected outputText: GeoText;
  protected n: GeoNumeric | number;

  constructor(kernel: IKernel, n: GeoNumeric | number) {
    super(kernel);
    this.n = n;
    this.outputText = new GeoText(kernel, '');
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = this.n instanceof GeoNumeric ? [this.n] : [];
    this.setOutput([this.outputText]);
  }

  compute(): void {
    const value = typeof this.n === 'number' ? this.n : this.n.getValue();
    this.outputText.text = this.format(value);
    this.outputText.setDefined();
  }

  getOutput(): GeoText { return this.outputText; }
  getN(): GeoNumeric | number { return this.n; }

  protected abstract format(value: number): string;
}

/** FractionText(number)：连分数有理逼近。 */
export class AlgoFractionText extends AlgoLiveText {
  protected format(value: number): string { return fractionText(value); }
}

/** ScientificText(number)：科学计数文本。 */
export class AlgoScientificText extends AlgoLiveText {
  protected format(value: number): string { return scientificText(value); }
}

// ---------------------------------------------------------------------------

/** 静态文本产出的公共尾（建自有 GeoText，标签由调用方分配）。 */
export function makeText(kernel: IKernel, text: string): GeoText {
  const geo = new GeoText(kernel, text);
  geo.setDefined();
  return geo;
}

/** Name(obj)：对象标签文本。 */
export function nameOf(obj: GeoElement): string {
  return obj.label || obj.getClassName();
}

/** FormulaText(obj)：对象的代数描述（官方为 LaTeX；Mini 无 LaTeX 渲染，取描述文本）。 */
export function formulaText(obj: GeoElement): string {
  return obj.getAlgebraDescription();
}

/** TableText(list1, list2, ...)：行由列表组成，单元格 `&` 连接、行 `\\` 连接
 *  （官方默认 LaTeX array 语义的原始文本）。单元格取元素代数描述或标签。 */
export function tableText(rows: GeoElement[][]): string {
  // 单元格：有标签用标签；自有数值/点（字面量子元素）用值/坐标
  const cell = (el: GeoElement): string => {
    if (el.label) return el.label;
    if (el instanceof GeoNumeric) return String(el.getValue());
    if (el instanceof GeoPoint) return `(${el.getX()}, ${el.getY()})`;
    return el.getAlgebraDescription();
  };
  return rows.map(row => row.map(cell).join(' & ')).join(' \\\\ ');
}

/** Split(text[, delimiters])：分隔符缺省按空白；产出文本列表。 */
export function splitText(text: string, delimiters?: string): string[] {
  if (delimiters) {
    return text.split(new RegExp(`[${delimiters.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]+`)).filter(s => s.length > 0);
  }
  return text.split(/\s+/).filter(s => s.length > 0);
}

/** TextToUnicode：字符码点数组。 */
export function textToUnicode(text: string): number[] {
  return Array.from(text).map(ch => ch.codePointAt(0) ?? 0);
}

/** UnicodeToText：码点（或码点列表）→ 文本。 */
export function unicodeToText(input: number | number[]): string {
  const codes = Array.isArray(input) ? input : [input];
  return codes
    .filter(c => Number.isFinite(c) && c > 0)
    .map(c => String.fromCodePoint(Math.round(c)))
    .join('');
}

/** 自有文本列表构建（Split/TextToUnicode 的输出容器）。 */
export function makeTextList(kernel: IKernel, texts: string[]): GeoList {
  const children = texts.map(t => {
    const geo = new GeoText(kernel, t);
    geo.setDefined();
    return geo;
  });
  return new GeoList(kernel, children);
}

/** 自有数值列表构建（TextToUnicode 输出）。 */
export function makeNumericList(kernel: IKernel, values: number[]): GeoList {
  const children = values.map(v => new GeoNumeric(kernel, v));
  return new GeoList(kernel, children);
}
