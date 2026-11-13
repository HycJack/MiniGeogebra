/**
 * Function(f, a, b) 限域函数（对标官方 CmdFunction 三参形）：
 * 输出与源函数同表达式的 GeoFunction，定义域 [a, b]——求值域外 NaN、
 * 采样/绘制/积分/PointOn 自动截断。源为活依赖（f 重定义后表达式跟随）。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoFunction } from '../geo/GeoFunction';
import { GeoNumeric } from '../geo/GeoNumeric';
import { AlgoDependentFunction } from './AlgoDependentFunction';

export class AlgoFunctionRestricted extends AlgoElement {
  private outputFunction: GeoFunction;

  constructor(
    kernel: IKernel,
    private source: GeoFunction,
    private lo: GeoNumeric | number,
    private hi: GeoNumeric | number,
  ) {
    super(kernel);
    this.outputFunction = new GeoFunction(kernel, { kind: 'number', value: 0 }, source.variableName, '0');
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.source, ...(this.lo instanceof GeoNumeric ? [this.lo] : []), ...(this.hi instanceof GeoNumeric ? [this.hi] : [])];
    this.setOutput([this.outputFunction]);
  }

  compute(): void {
    const lo = typeof this.lo === 'number' ? this.lo : this.lo.getValue();
    const hi = typeof this.hi === 'number' ? this.hi : this.hi.getValue();
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      this.outputFunction.setUndefined();
      return;
    }
    // 表达式跟随源（f 重定义 → 限域函数跟随）；域外求值由 GeoFunction.evaluateAt 拦
    this.outputFunction.setExpressionDef(this.source.expression, this.source.expressionText);
    this.outputFunction.setScope(this.source.getScopeShallow());
    const userFns = this.source.getUserFunctions();
    if (userFns) this.outputFunction.setUserFunctions(userFns);
    this.outputFunction.setDomain(lo, hi);
    this.outputFunction.setDefined();
  }

  getOutput(): GeoFunction { return this.outputFunction; }
  getLo(): GeoNumeric | number { return this.lo; }
  getHi(): GeoNumeric | number { return this.hi; }
  /** 源函数（AlgoDependentFunction）的数值依赖——Root/Integral/求导等
   *  命令侧求值闭包需要它重建 scope（此前限域函数 scope 被清空 → 全线 NaN）。 */
  getSource(): GeoFunction { return this.source; }
  /** 与 AlgoDependentFunction 同形：求值闭包/导数链按鸭子类型取依赖。 */
  getDependencies(): GeoNumeric[] {
    return this.source.parentAlgo instanceof AlgoDependentFunction
      ? this.source.parentAlgo.getDependencies()
      : [];
  }
}
