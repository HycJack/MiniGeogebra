/**
 * 列表操作算法族（对标官方 kernel/algos 的 AlgoSequence / AlgoElementList /
 * AlgoFirst / AlgoLast / AlgoTake / AlgoSort / AlgoUnique / AlgoReverse /
 * AlgoAppend / AlgoInsert / AlgoRemove / AlgoRemoveUndefined / AlgoFlatten /
 * AlgoJoin / AlgoSum / AlgoMin / AlgoMax / AlgoIndexOf）。
 *
 * 活依赖：输入列表/数值入 input，源变动时输出重算。
 * 产出列表的**子元素为本算法自有对象**（不进构造、不占标签）——与
 * AlgoRootList（子元素为构造内兄弟算法输出）不同；序列化时自有子元素
 * constIndex=-1 走 childScalars/childPoints 通道，加载后由算法重算回填。
 */

import { IKernel } from '../core/Interfaces';
import { AlgoElement } from './AlgoElement';
import { GeoElement } from '../geo/GeoElement';
import { GeoList } from '../geo/GeoList';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoText } from '../geo/GeoText';
import { GeoVec3D } from '../core/GeoVec3D';
import { ExpressionNode, Scope } from '../algebra/ExpressionNode';
import { evaluate, UserFunctionView } from '../algebra/ExpressionEvaluator';
import { GeoFunction } from '../geo/GeoFunction';

export type OwnedChild = GeoNumeric | GeoPoint | GeoText | GeoList;

/** 深拷贝子元素为自有对象；非可克隆类型返回 null（调用方置 undefined 子元素）。 */
export function cloneChild(kernel: IKernel, el: GeoElement): OwnedChild | null {
  if (el instanceof GeoNumeric) {
    const child = new GeoNumeric(kernel, el.getValue());
    if (!el.isDefined() || !Number.isFinite(el.getValue())) child.setUndefined();
    return child;
  }
  if (el instanceof GeoPoint) {
    const p = new GeoPoint(kernel, new GeoVec3D(0, 0, 1));
    p.setCoords(el.getX(), el.getY());
    if (!el.isDefined()) p.setUndefined();
    return p;
  }
  if (el instanceof GeoText) {
    const t = new GeoText(kernel, el.text, el.x, el.y);
    t.setDefined();
    return t;
  }
  if (el instanceof GeoList) {
    // 官方 Join 语义：深层子列表作为元素原样保留（AlgoJoin.java:88-122），
    // 此前 cloneChild 对子列表返回 null 被静默丢弃
    const children = el.getChildren().map(c => cloneChild(kernel, c));
    return new GeoList(kernel, children.filter((c): c is OwnedChild => c !== null));
  }
  return null;
}

/** 排序键：数值取值；点按 x（x 同再比 y 由比较器处理，官方 getComparatorX）；文本字典序。 */
const sortKey = (el: GeoElement): number | string => {
  if (el instanceof GeoNumeric) return el.getValue();
  if (el instanceof GeoPoint) {
    const x = el.getX();
    return Number.isFinite(x) ? x : Number.POSITIVE_INFINITY;
  }
  if (el instanceof GeoText) return el.text;
  return Number.POSITIVE_INFINITY;
};

const sameChild = (a: GeoElement, b: GeoElement): boolean => {
  if (a instanceof GeoNumeric && b instanceof GeoNumeric) {
    return Math.abs(a.getValue() - b.getValue()) < 1e-12;
  }
  if (a instanceof GeoPoint && b instanceof GeoPoint) {
    return Math.hypot(a.getX() - b.getX(), a.getY() - b.getY()) < 1e-12;
  }
  if (a instanceof GeoText && b instanceof GeoText) return a.text === b.text;
  if (a instanceof GeoList && b instanceof GeoList) {
    const ca = a.getChildren();
    const cb = b.getChildren();
    return ca.length === cb.length && ca.every((c, i) => sameChild(c, cb[i]));
  }
  return false;
};

/** 展开输入项：deep=true 递归展平所有层（官方 Flatten）；
 *  shallow（官方 Join）只展开一层，深层子列表作为元素保留。 */
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
 * 活依赖——表达式内的数值依赖、**用户函数**与区间端点入 input（此前用户函数
 * AST 快照冻结，f 重定义整表不动），滑块拖动整表重算。
 * 子元素为自有 GeoNumeric（不占标签、不进构造），长度上限 1000。
 * 支持带符号步长（降序序列，官方 AlgoSequence.java:264-273）与端点容差。
 */
export class AlgoSequence extends AlgoElement {
  private outputList: GeoList;
  private deps: GeoNumeric[];
  private fnDeps: GeoFunction[];

  constructor(
    kernel: IKernel,
    private expression: ExpressionNode,
    private variableName: string,
    private from: GeoNumeric | number,
    private to: GeoNumeric | number,
    private step: GeoNumeric | number = 1,
    deps: GeoNumeric[] = [],
    fnDeps: GeoFunction[] = [],
  ) {
    super(kernel);
    this.deps = deps;
    this.fnDeps = fnDeps;
    this.outputList = new GeoList(kernel, []);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [...liveNumerics(this.from, this.to, this.step), ...this.deps, ...this.fnDeps];
    this.setOutput([this.outputList]);
  }

  compute(): void {
    const from = valueOf(this.from);
    const to = valueOf(this.to);
    const step = valueOf(this.step);
    if (!Number.isFinite(from) || !Number.isFinite(to) || !Number.isFinite(step) || step === 0
        || (to - from) * step < 0) {
      this.outputList.setChildren([]);
      this.outputList.setDefined();
      return;
    }
    // 端点容差：0.1 步进的浮点累积不丢终点（官方 MIN_PRECISION 语义）
    const tolerance = 1e-9 * Math.max(1, Math.abs(from), Math.abs(to), Math.abs(step));
    const count = Math.min(Math.floor((to - from) / step + tolerance) + 1, 1000);
    // 用户函数表按活引用重建（重定义后 AST 跟随；此前快照冻结）
    const userFns = new Map<string, UserFunctionView>();
    for (const fn of this.fnDeps) {
      if (fn.label) userFns.set(fn.label, { expression: fn.expression, variableName: fn.variableName });
    }
    const baseScope: Scope = new Map();
    for (const dep of this.deps) {
      if (dep.label) baseScope.set(dep.label, dep.getValue());
    }
    const children: OwnedChild[] = [];
    for (let i = 0; i < count; i++) {
      const scope: Scope = new Map(baseScope);
      scope.set(this.variableName, from + i * step);
      const v = evaluate(this.expression, scope, userFns);
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

// ---------------------------------------------------------------------------

/**
 * 列表→单元素（官方 Element / 单参 First/Last）：数值列表出数值、点列表出点。
 * 输出类型**惰性判定**——序列化 roundtrip 时子元素在算法重建后才回填，
 * 构造期首子元素判定必然落空成数值输出（此前点列表 roundtrip 后恒 NaN）。
 * 单参 Last 用 'last' 模式活取列表长度（官方 AlgoLast 语义）。
 */
export class AlgoListElement extends AlgoElement {
  private outputNumeric: GeoNumeric;
  private outputPoint: GeoPoint | null = null;
  private takeLast: boolean;

  constructor(kernel: IKernel, private list: GeoList, private index: GeoNumeric | number | 'last') {
    super(kernel);
    this.takeLast = index === 'last';
    this.outputNumeric = new GeoNumeric(kernel, NaN);
    this.setOutput([this.outputNumeric]);
    this.input = [this.list, ...(this.index === 'last' || typeof this.index === 'number' ? [] : [this.index])];
  }

  setInputOutput(): void {
    // 构造器已设（输出类型惰性判定，不能在此提前定型）
  }

  compute(): void {
    const children = this.list.getChildren();
    const idx = this.takeLast ? children.length : Math.round(valueOf(this.index as GeoNumeric | number));
    if (idx < 1 || idx > children.length) {
      this.outputNumeric.setUndefined();
      this.outputPoint?.setUndefined();
      return;
    }
    const child = children[idx - 1];
    // 惰性定型：首个可解析子元素是点 → 切换点输出
    if (!this.outputPoint && child instanceof GeoPoint) {
      this.outputPoint = new GeoPoint(this.kernel, new GeoVec3D(0, 0, 1));
      this.setOutput([this.outputPoint]);
    }
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
  getIndex(): GeoNumeric | number | 'last' { return this.index; }
  /** 主输出（点列表 → 点，数值列表 → 数值）。 */
  getPrimaryOutput(): GeoNumeric | GeoPoint { return this.outputPoint ?? this.outputNumeric; }
}

// ---------------------------------------------------------------------------

/** 列表聚合 → 数值或点（官方 Sum/Min/Max/Product/IndexOf；Sum 对点列表返回点）。 */
export type ListAggregateOp = 'sum' | 'product' | 'min' | 'max' | 'indexOf';

/** 序列化 op 编码表（下标落盘，类名跨版本稳定契约）。 */
export const LIST_AGGREGATE_OPS: ListAggregateOp[] = ['sum', 'product', 'min', 'max', 'indexOf'];

export class AlgoListAggregate extends AlgoElement {
  private outputValue: GeoNumeric;
  private outputPoint: GeoPoint | null = null;

  constructor(
    kernel: IKernel,
    private op: ListAggregateOp,
    private list: GeoList,
    private arg: GeoElement | null = null, // indexOf 的目标项
    private truncate: GeoNumeric | number | null = null, // 官方 Sum(list, n)：前 n 项
  ) {
    super(kernel);
    this.outputValue = new GeoNumeric(kernel, NaN);
    this.setOutput([this.outputValue]);
    this.setInputOutput();
  }

  setInputOutput(): void {
    this.input = [this.list, ...(this.arg ? [this.arg] : []), ...liveNumerics(this.truncate)];
  }

  compute(): void {
    // 官方 AlgoStats1D Truncate 语义：n<1 或 n>size → undefined、n=0 → 0、
    // 否则只聚合前 n 项
    let children = this.list.getChildren();
    if (this.truncate !== null) {
      const n = Math.round(valueOf(this.truncate));
      if (!Number.isFinite(n)) { this.outputValue.setUndefined(); return; }
      if (n === 0) { this.outputValue.setValue(this.op === 'product' ? 1 : 0); this.outputValue.setDefined(); return; }
      if (n < 1 || n > children.length) { this.outputValue.setUndefined(); return; }
      children = children.slice(0, n);
    }
    switch (this.op) {
      case 'sum': {
        // 官方 CmdSum：点/向量列表求和返回点（FoldComputer 语义，此前点被无声跳过）
        const allPoints = children.length > 0 && children.every(c => c instanceof GeoPoint);
        if (allPoints) {
          if (!this.outputPoint) {
            this.outputPoint = new GeoPoint(this.kernel, new GeoVec3D(0, 0, 1));
            this.setOutput([this.outputPoint]);
          }
          let sx = 0, sy = 0;
          for (const c of children) {
            const p = c as GeoPoint;
            if (Number.isFinite(p.getX()) && Number.isFinite(p.getY())) { sx += p.getX(); sy += p.getY(); }
          }
          this.outputPoint.setCoords(sx, sy);
          this.outputPoint.setDefined();
          return;
        }
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
        // 官方 AlgoIndexOf：未找到保持 undefined（此前输出 0）
        if (found === 0) { this.outputValue.setUndefined(); return; }
        this.outputValue.setValue(found);
        break;
      }
    }
    this.outputValue.setDefined();
  }

  getOutput(): GeoNumeric { return this.outputValue; }
  getOp(): ListAggregateOp { return this.op; }
  /** 主输出（点列表求和 → 点，数值聚合 → 数值）。 */
  getPrimaryOutput(): GeoNumeric | GeoPoint { return this.outputPoint ?? this.outputValue; }
}

// ---------------------------------------------------------------------------

/** 列表 → 列表变换（官方 First(n)/Last(n)/Take/Sort/Unique/Reverse/Append/Insert/
 *  Remove/RemoveUndefined/Flatten/Join/Remove(list, 位置列表)）。
 *  子元素为自有拷贝。越界按官方语义置 undefined（此前静默钳制返回错误内容）。 */
export type ListTransformOp =
  | 'first' | 'last' | 'take' | 'sort' | 'unique' | 'reverse'
  | 'append' | 'insert' | 'remove' | 'removeUndefined' | 'flatten' | 'join' | 'removePositions';

export const LIST_TRANSFORM_OPS: ListTransformOp[] = [
  'first', 'last', 'take', 'sort', 'unique', 'reverse',
  'append', 'insert', 'remove', 'removeUndefined', 'flatten', 'join', 'removePositions',
];

export class AlgoListTransform extends AlgoElement {
  private outputList: GeoList;

  constructor(
    kernel: IKernel,
    private op: ListTransformOp,
    private list: GeoList,
    private list2: GeoList | null = null,   // join 第二列表 / removePositions 位置表
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
    // Join 官方语义（AlgoJoin.java:88-122）：参数是**待拼接的列表**——
    // 依序拼接各列表的元素（Join({{1,2},{3,{4}}}) = {1,2,3,{4}}）：子列表
    // 展开其元素，深层子列表（{4}）作为元素保留。此前把子列表整体当元素。
    let flat: GeoElement[];
    if (this.op === 'join') {
      flat = [];
      for (const src of [this.list, ...(this.list2 ? [this.list2] : [])]) {
        if (src instanceof GeoList) {
          for (const c of src.getChildren()) {
            if (c instanceof GeoList) flat.push(...c.getChildren());
            else flat.push(c);
          }
        } else {
          flat.push(src);
        }
      }
    } else {
      flat = flattenItems([this.list], this.op === 'flatten');
    }
    const n1 = this.n1 === null ? null : Math.round(valueOf(this.n1));
    const n2 = this.n2 === null ? null : Math.round(valueOf(this.n2));
    let outOfRange = false;

    switch (this.op) {
      case 'first':
        if (n1 === null) flat = flat.slice(0, 1);
        else if (n1 < 0 || n1 > flat.length) outOfRange = true;
        else flat = flat.slice(0, n1);
        break;
      case 'last':
        if (n1 === null) flat = flat.slice(-1);
        else if (n1 < 0 || n1 > flat.length) outOfRange = true;
        else flat = flat.slice(flat.length - n1);
        break;
      case 'take':
        // 官方 AlgoTake：两参 Take(list, n) = 末 n 个；三参 start≤0 || end>size || start>end → undefined
        if (n1 !== null && n2 === null) {
          if (n1 < 0 || n1 > flat.length) outOfRange = true;
          else flat = flat.slice(flat.length - n1);
        } else if (n1 !== null && n2 !== null) {
          if (n1 <= 0 || n2 > flat.length || n1 > n2) outOfRange = true;
          else flat = flat.slice(n1 - 1, n2);
        }
        break;
      case 'sort':
        flat = [...flat].sort((a, b) => {
          const ka = sortKey(a), kb = sortKey(b);
          if (typeof ka === 'string' || typeof kb === 'string') {
            return String(ka) < String(kb) ? -1 : String(ka) > String(kb) ? 1 : 0;
          }
          if (ka !== kb) return ka - kb;
          // 点 x 相同再比 y（官方 getComparatorX，此前只比 x）
          if (a instanceof GeoPoint && b instanceof GeoPoint) return a.getY() - b.getY();
          return 0;
        });
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
        // 官方 AlgoInsert：-1 = 末尾插入；越界 → undefined（此前钳制到边界）
        if (this.item && n1 !== null) {
          if (n1 === -1) {
            flat = [...flat, this.item];
          } else if (n1 < 0 || n1 > flat.length + 1) {
            outOfRange = true;
          } else {
            flat = [...flat.slice(0, n1 - 1), this.item, ...flat.slice(n1 - 1)];
          }
        }
        break;
      }
      case 'remove':
        if (n1 !== null && (n1 < 1 || n1 > flat.length)) outOfRange = true;
        else if (n1 !== null) flat = [...flat.slice(0, n1 - 1), ...flat.slice(n1)];
        break;
      case 'removePositions': {
        // 官方 CmdRemove：Remove(list, 位置列表) 批量删
        const positions = this.list2
          ? this.list2.getChildren().map(c => (c instanceof GeoNumeric ? Math.round(c.getValue()) : -1))
          : [];
        const drop = new Set(positions.filter(p => p >= 1 && p <= flat.length));
        if (positions.some(p => p < 1 || p > flat.length)) outOfRange = true;
        flat = flat.filter((_, i) => !drop.has(i + 1));
        break;
      }
      case 'removeUndefined':
        flat = flat.filter(c => c.isDefined());
        break;
      case 'flatten':
      case 'join':
        break; // flattenItems 已按 deep/shallow 展开完毕
    }

    if (outOfRange) {
      this.outputList.setChildren([]);
      this.outputList.setUndefined();
      return;
    }

    const children: OwnedChild[] = [];
    for (const c of flat) {
      const owned = cloneChild(this.kernel, c);
      if (owned) children.push(owned);
      else {
        // 非可克隆元素（布尔等）：undefined 占位而非静默丢弃（官方保留位置）
        const undef = new GeoNumeric(this.kernel, NaN);
        undef.setUndefined();
        children.push(undef);
      }
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
