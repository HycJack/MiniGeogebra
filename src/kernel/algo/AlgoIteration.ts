/**
 * 迭代命令族（对标官方 AlgoIteration / AlgoIterationList）：
 * Iteration(f, start, n) → f 复合 n 次的值；IterationList(f, start, n) →
 * [start, f(start), ..., f^n(start)]（自有子元素，长度 n+1，上限 1000）。
 * f 为活依赖（重定义后重算）；start/n 静态或活数值。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoList } from '../geo/GeoList';

const MAX_ITERATIONS = 1000;

const valueOf = (n: GeoNumeric | number): number => (typeof n === 'number' ? n : n.getValue());
const liveOf = (...ns: (GeoNumeric | number)[]): GeoNumeric[] =>
  ns.filter((n): n is GeoNumeric => n instanceof GeoNumeric);

/** Iteration(f, start, n)：f^n(start)。 */
export class AlgoIteration extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(kernel: IKernel, private f: GeoFunction, private start: GeoNumeric | number, private n: GeoNumeric | number) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, NaN);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.f, ...liveOf(this.start, this.n)];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const n = Math.round(valueOf(this.n));
    if (n < 0 || n > MAX_ITERATIONS) { this.outputValue.setUndefined(); return; }
    let v = valueOf(this.start);
    for (let i = 0; i < n; i++) {
      v = this.f.evaluateAt(v);
      if (!Number.isFinite(v)) { this.outputValue.setUndefined(); return; }
    }
    this.outputValue.setValue(v);
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
  getBounds(): [GeoNumeric | number, GeoNumeric | number] { return [this.start, this.n]; }
}

/** IterationList(f, start, n)：迭代轨道列表（含初值，n+1 项）。 */
export class AlgoIterationList extends AlgoElement {
  private outputList: GeoList;

  constructor(kernel: IKernel, private f: GeoFunction, private start: GeoNumeric | number, private n: GeoNumeric | number) {
    super(kernel);
    this.outputList = new GeoList(kernel, []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.f, ...liveOf(this.start, this.n)];
    this.setOutput([this.outputList]);
  }

  compute(): void {
    const n = Math.round(valueOf(this.n));
    if (n < 0 || n > MAX_ITERATIONS) { this.outputList.setChildren([]); this.outputList.setDefined(); return; }
    const children: GeoNumeric[] = [];
    let v = valueOf(this.start);
    for (let i = 0; i <= n; i++) {
      const child = new GeoNumeric(this.kernel, v);
      if (!Number.isFinite(v)) child.setUndefined();
      children.push(child);
      v = this.f.evaluateAt(v);
      if (!Number.isFinite(v)) break; // 后续全 undefined：截断（官方轨道发散即停）
    }
    this.outputList.setChildren(children);
    this.outputList.setDefined();
  }

  getOutput(): GeoList { return this.outputList; }
  getBounds(): [GeoNumeric | number, GeoNumeric | number] { return [this.start, this.n]; }
}
