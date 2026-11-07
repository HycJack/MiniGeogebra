/**
 * 列表操作算法族（对标官方 kernel/algos 的 AlgoSequence / AlgoElementList /
 * AlgoFirst / AlgoLast / AlgoTake / AlgoSort / AlgoUnique / AlgoReverse /
 * AlgoAppend / AlgoInsert / AlgoRemove / AlgoRemoveUndefined / AlgoFlatten /
 * AlgoJoin / AlgoSum / AlgoMin / AlgoMax / AlgoIndexOf）。
 *
 * 活依赖：输入列表/数值入 input，源变动时输出重算。
 * 产出列表的**子元素为本算法自有对象**（不进构造、不占标签）——与
 * AlgoRootList（子元素为构造内兄弟算法输出）不同；序列化时自有子元素
 * constIndex=-1 被 childIndices 过滤丢弃，加载后由算法重算回填。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoList } from '../geo/GeoList';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoVec3D } from '../core/GeoVec3D';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';
import { evaluate, UserFunctionView } from '../algebra/ExpressionEvaluator';

export type OwnedChild = GeoNumeric | GeoPoint;

/** 深拷贝一个子元素为自有对象（数值/点；其他类型按数值域处理返回 null）。 */
export function cloneChild(kernel: IKernel, el: GeoElement): OwnedChild | null {
  if (el instanceof GeoNumeric) return new GeoNumeric(kernel, el.getValue());
  if (el instanceof GeoPoint) {
    const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    p.setCoords(el.getX(), el.getY());
    return p;
  }
  return null;
}

/** 子元素排序键（数值取值；点按 x 再 y）。 */
const sortKey = (el: GeoElement): number => {
  if (el instanceof GeoNumeric) return el.getValue();
  if (el instanceof GeoPoint) {
    const x = el.getX();
    return Number.isFinite(x) ? x : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
};

const sameChild = (a: GeoElement, b: GeoElement): boolean => {
  if (a instanceof GeoNumeric && b instanceof GeoNumeric) {
    return Math.abs(a.getValue() - b.getValue()) < 1e-12;
  }
  if (a instanceof GeoPoint && b instanceof GeoPoint) {
    return Math.hypot(a.getX() - b.getX(), a.getY() - b.getY()) < 1e-12;
  }
  return false;
};

/** 有序展开输入元素为扁平"项"序列：列表展开一层（Join 语义），标量/点原样。 */
function flattenItems(items: GeoElement[], deep: boolean): GeoElement[] {
  const out: GeoElement[] = [];
  for (const item of items) {
    if (item instanceof GeoList) {
      for (const c of item.getChildren()) {
        if (deep && c instanceof GeoList) out.push(...flattenItems([c], true));
        else out.push(c);
      }
    } else {
      out.push(item);
    }
  }
  return out;
}

/** 参数值：活数值取当前值，否则用静态值。 */
const valueOf = (n: GeoNumeric | number): number => (typeof n === 'number' ? n : n.getValue());

/** 活数值依赖收集（静态数不入 input）。 */
function liveNumerics(...ns: (GeoNumeric | number | null | undefined)[]): GeoNumeric[] {
  return ns.filter((n): n is GeoNumeric => n instanceof GeoNumeric);
}

// ---------------------------------------------------------------------------

/**
 * Sequence(expr, k, from, to[, step])（官方 AlgoSequence）：
 * 活依赖——表达式内的数值依赖与区间端点入 input，滑块拖动整表重算。
 * 子元素为自有 GeoNumeric（不占标签、不进构造），长度上限 1000。
 */
export class AlgoSequence extends AlgoElement {
  private outputList: GeoList;
  private deps: GeoNumeric[];
  private userFns: Map<string, UserFunctionView>;

  constructor(
    kernel: IKernel,
    private expression: ExpressionNode,
    private variableName: string,
    private from: GeoNumeric | number,
    private to: GeoNumeric | number,
    private step: GeoNumeric | number = 1,
    deps: GeoNumeric[] = [],
    userFns: GeoFunctionView[] = [],
  ) {
    super(kernel);
    this.deps = deps;
    this.userFns = new Map(userFns.map(f => [f.label, { expression: f.expression, variableName: f.variableName }]));
    this.outputList = new GeoList(kernel, []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...liveNumerics(this.from, this.to, this.step), ...this.deps];
    this.setOutput([this.outputList]);
  }

  compute(): void {
    const from = valueOf(this.from);
    const to = valueOf(this.to);
    const step = Math.abs(valueOf(this.step)) || 1;
    if (!Number.isFinite(from) || !Number.isFinite(to) || (to - from) * step < 0) {
      this.outputList.setChildren([]);
      this.outputList.setDefined();
      return;
    }
    const count = Math.min(Math.floor((to - from) / step) + 1, 1000);
    const baseScope: Scope = new Map();
    for (const dep of this.deps) {
      if (dep.label) baseScope.set(dep.label, dep.getValue());
    }
    const children: OwnedChild[] = [];
    for (let i = 0; i < count; i++) {
      const scope: Scope = new Map(baseScope);
      scope.set(this.variableName, from + i * step);
      const v = evaluate(this.expression, scope, this.userFns);
      const child = new GeoNumeric(this.kernel, v);
      if (Number.isNaN(v)) child.setUndefined();
      children.push(child);
    }
    this.outputList.setChildren(children);
    this.outputList.setDefined();
  }

  getOutput(): GeoList { return this.outputList; }
  getExpressionText(): string { return this.commandText; }
  /** 原始命令文本（序列化经 parseAlgebraInput 重建）。 */
  commandText = '';
}

/** 用户函数视图（避免循环依赖 GeoFunction，由识别器传入）。 */
export interface GeoFunctionView {
  label: string;
  expression: ExpressionNode;
  variableName: string;
}

// ---------------------------------------------------------------------------

/** 列表→单元素（官方 Element / 单参 First/Last）：数值列表出数值、点列表出点。 */
export class AlgoListElement extends AlgoElement {
  private outputNumeric: GeoNumeric;
  private outputPoint: GeoPoint | null = null;

  constructor(kernel: IKernel, private list: GeoList, private index: GeoNumeric | number) {
    super(kernel);
    // 输出类型按首子元素判定（构造期一次；空列表退化为数值输出）
    const first = list.getChildren().find(c => c instanceof GeoNumeric || c instanceof GeoPoint);
    if (first instanceof GeoPoint) {
      this.outputPoint = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
      this.outputNumeric = new GeoNumeric(kernel, NaN);
      this.setOutput([this.outputPoint]);
    } else {
      this.outputNumeric = new GeoNumeric(kernel, NaN);
      this.setOutput([this.outputNumeric]);
    }
    this.input = [this.list, ...liveNumerics(this.index)];
  }

  setInputOutput(): void {
    // 构造器已设（输出类型依赖首子元素判定）
  }

  compute(): void {
    const children = this.list.getChildren();
    const idx = Math.round(valueOf(this.index));
    if (idx < 1 || idx > children.length) {
      this.outputNumeric.setUndefined();
      this.outputPoint?.setUndefined();
      return;
    }
    const child = children[idx - 1];
    if (this.outputPoint) {
      if (child instanceof GeoPoint) {
        this.outputPoint.setCoords(child.getX(), child.getY());
        this.outputPoint.setDefined();
      } else {
        this.outputPoint.setUndefined();
      }
    } else if (child instanceof GeoNumeric) {
      this.outputNumeric.setValue(child.getValue());
      this.outputNumeric.setDefined();
    } else {
      this.outputNumeric.setUndefined();
    }
  }

  getOutput(): GeoNumeric { return this.outputNumeric; }
  getOutputPoint(): GeoPoint | null { return this.outputPoint; }
  getIndex(): GeoNumeric | number { return this.index; }
  /** 主输出（点列表 → 点，数值列表 → 数值）。 */
  getPrimaryOutput(): GeoNumeric | GeoPoint { return this.outputPoint ?? this.outputNumeric; }
}

// ---------------------------------------------------------------------------

/** 列表聚合 → 数值（官方 Sum/Min/Max/Product/IndexOf）。 */
export type ListAggregateOp = 'sum' | 'product' | 'min' | 'max' | 'indexOf';

/** 序列化 op 编码表（下标落盘，类名跨版本稳定契约）。 */
export const LIST_AGGREGATE_OPS: ListAggregateOp[] = ['sum', 'product', 'min', 'max', 'indexOf'];

export class AlgoListAggregate extends AlgoElement {
  private outputValue: GeoNumeric;

  constructor(
    kernel: IKernel,
    private op: ListAggregateOp,
    private list: GeoList,
    private arg: GeoNumeric | GeoElement | null = null, // indexOf 的目标项
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, NaN);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.list, ...(this.arg ? [this.arg] : [])];
    this.setOutput([this.outputValue]);
  }

  compute(): void {
    const children = this.list.getChildren();
    switch (this.op) {
      case 'sum': {
        let acc = 0;
        for (const c of children) {
          if (c instanceof GeoNumeric && Number.isFinite(c.getValue())) acc += c.getValue();
        }
        this.outputValue.setValue(acc);
        break;
      }
      case 'product': {
        let acc = 1;
        for (const c of children) {
          if (c instanceof GeoNumeric && Number.isFinite(c.getValue())) acc *= c.getValue();
        }
        this.outputValue.setValue(acc);
        break;
      }
      case 'min':
      case 'max': {
        const values = children
          .filter((c): c is GeoNumeric => c instanceof GeoNumeric && c.isDefined() && Number.isFinite(c.getValue()))
          .map(c => c.getValue());
        if (values.length === 0) { this.outputValue.setUndefined(); return; }
        this.outputValue.setValue(this.op === 'min' ? Math.min(...values) : Math.max(...values));
        break;
      }
      case 'indexOf': {
        let found = 0;
        for (let i = 0; i < children.length; i++) {
          if (this.arg && sameChild(children[i], this.arg)) { found = i + 1; break; }
        }
        this.outputValue.setValue(found);
        break;
      }
    }
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
  getOp(): ListAggregateOp { return this.op; }
}

// ---------------------------------------------------------------------------

/** 列表 → 列表变换（官方 First(n)/Last(n)/Take/Sort/Unique/Reverse/Append/Insert/
 *  Remove/RemoveUndefined/Flatten/Join）。子元素为自有拷贝。 */
export type ListTransformOp =
  | 'first' | 'last' | 'take' | 'sort' | 'unique' | 'reverse'
  | 'append' | 'insert' | 'remove' | 'removeUndefined' | 'flatten' | 'join';

export const LIST_TRANSFORM_OPS: ListTransformOp[] = [
  'first', 'last', 'take', 'sort', 'unique', 'reverse',
  'append', 'insert', 'remove', 'removeUndefined', 'flatten', 'join',
];

export class AlgoListTransform extends AlgoElement {
  private outputList: GeoList;

  constructor(
    kernel: IKernel,
    private op: ListTransformOp,
    private list: GeoList,
    private list2: GeoList | null = null,   // join 的第二个列表
    private item: GeoElement | null = null, // append/insert 的项
    private n1: GeoNumeric | number | null = null,
    private n2: GeoNumeric | number | null = null,
  ) {
    super(kernel);
    this.outputList = new GeoList(kernel, []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    const inputs: GeoElement[] = [this.list];
    if (this.list2) inputs.push(this.list2);
    if (this.item) inputs.push(this.item);
    inputs.push(...liveNumerics(this.n1, this.n2));
    this.input = inputs;
    this.setOutput([this.outputList]);
  }

  compute(): void {
    const items: GeoElement[] = [this.list, ...(this.list2 ? [this.list2] : [])];
    let flat = flattenItems(items, this.op === 'flatten');
    const n1 = this.n1 === null ? null : Math.round(valueOf(this.n1));
    const n2 = this.n2 === null ? null : Math.round(valueOf(this.n2));

    switch (this.op) {
      case 'first':
        if (n1 === null) flat = flat.slice(0, 1);
        else flat = flat.slice(0, Math.max(0, n1));
        break;
      case 'last':
        if (n1 === null) flat = flat.slice(-1);
        else flat = flat.slice(Math.max(0, flat.length - Math.max(0, n1)));
        break;
      case 'take':
        // Take(list, a, b)：1-based 闭区间
        if (n1 !== null && n2 !== null) {
          flat = flat.slice(Math.max(0, n1 - 1), Math.max(n1 - 1, n2));
        }
        break;
      case 'sort':
        flat = [...flat].sort((a, b) => sortKey(a) - sortKey(b));
        break;
      case 'unique': {
        const out: GeoElement[] = [];
        for (const c of flat) {
          if (!out.some(e => sameChild(e, c))) out.push(c);
        }
        flat = out;
        break;
      }
      case 'reverse':
        flat = [...flat].reverse();
        break;
      case 'append':
        if (this.item) flat = [...flat, this.item];
        break;
      case 'insert': {
        if (this.item && n1 !== null) {
          const pos = Math.min(Math.max(1, n1), flat.length + 1);
          flat = [...flat.slice(0, pos - 1), this.item, ...flat.slice(pos - 1)];
        }
        break;
      }
      case 'remove':
        if (n1 !== null && n1 >= 1 && n1 <= flat.length) {
          flat = [...flat.slice(0, n1 - 1), ...flat.slice(n1)];
        }
        break;
      case 'removeUndefined':
        flat = flat.filter(c => c.isDefined());
        break;
      case 'flatten':
      case 'join':
        break; // flattenItems 已按 deep/浅 展开完毕
    }

    const children: OwnedChild[] = [];
    for (const c of flat) {
      const owned = cloneChild(this.kernel, c);
      if (owned) children.push(owned);
    }
    this.outputList.setChildren(children);
    this.outputList.setDefined();
  }

  getOutput(): GeoList { return this.outputList; }
  getOp(): ListTransformOp { return this.op; }
  getList2(): GeoList | null { return this.list2; }
  getItem(): GeoElement | null { return this.item; }
  getN1(): GeoNumeric | number | null { return this.n1; }
  getN2(): GeoNumeric | number | null { return this.n2; }
}
