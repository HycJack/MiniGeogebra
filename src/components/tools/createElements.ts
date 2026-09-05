/**
 * 几何元素构造辅助函数 —— 各工具模式共享。
 * 避免每个 mode 分支重复"创建点并命名"/"创建参数点"之类的样板代码。
 */

import { Kernel } from '../../kernel/core/Kernel';
import { Construction } from '../../kernel/core/Construction';
import { GeoPoint } from '../../kernel/geo/GeoPoint';
import { GeoNumeric } from '../../kernel/geo/GeoNumeric';
import { GeoSegment } from '../../kernel/geo/GeoSegment';
import { GeoLine } from '../../kernel/geo/GeoLine';
import { GeoConic } from '../../kernel/geo/GeoConic';
import { GeoPolyLine } from '../../kernel/geo/GeoPolyLine';
import { GeoVec3D } from '../../kernel/core/GeoVec3D';
import { AlgoElement } from '../../kernel/algo/AlgoElement';
import { AlgoPointOnSegment } from '../../kernel/algo/AlgoPointOnSegment';
import { AlgoPointOnLine } from '../../kernel/algo/AlgoPointOnLine';
import { AlgoPointOnConic } from '../../kernel/algo/AlgoPointOnConic';
import { AlgoPointOnPolyLine } from '../../kernel/algo/AlgoPointOnPolyLine';

/** 创建一个带唯一标签的独立点（A, B, C, D...）。 */
export function createLabeledPoint(kernel: Kernel, x: number, y: number, z = 1): GeoPoint {
  const p = new GeoPoint(kernel, new GeoVec3D(x, y, z));
  p.label = kernel.getConstruction().getNextPointLabel();
  return p;
}

/** 在构造中增加一个新点，并触发重算。 */
export function addPoint(kernel: Kernel, x: number, y: number): GeoPoint {
  const p = createLabeledPoint(kernel, x, y);
  kernel.getConstruction().addElement(p);
  kernel.notifyUpdate(p);
  return p;
}

/** 为距离测量生成唯一数值标签（原代码约定：d1,d2…）。 */
export function nextDistanceLabel(construction: Construction): string {
  const count = construction.getElements().filter(e => e instanceof GeoNumeric).length + 1;
  return `d${count}`;
}

/** 为角度测量生成唯一数值标签（原代码约定：∠）。 */
export function nextAngleLabel(construction: Construction): string {
  return '∠';
}

/** 为面积测量生成唯一数值标签（原代码约定：S）。 */
export function nextAreaLabel(construction: Construction): string {
  return 'S';
}

/** 在路径（线段/直线/圆/折线）上根据屏幕位置创建一个带参数的约束点。 */
export function createParameterPointOnPath(
  kernel: Kernel,
  path: GeoSegment | GeoLine | GeoConic | GeoPolyLine,
  screenX: number, screenY: number
): { param: GeoNumeric; point: GeoPoint; algo: AlgoElement } | null {
  const param = new GeoNumeric(kernel, 0);
  param.label = kernel.getConstruction().getNextNumericLabel();

  let algo: any;
  if (path instanceof GeoSegment) {
    param.intervalMin = 0; param.intervalMax = 1;
    algo = new AlgoPointOnSegment(kernel, path, param);
  } else if (path instanceof GeoLine) {
    param.intervalMin = -10; param.intervalMax = 10;
    algo = new AlgoPointOnLine(kernel, path, param);
  } else if (path instanceof GeoConic) {
    param.intervalMin = 0; param.intervalMax = 2 * Math.PI;
    algo = new AlgoPointOnConic(kernel, path, param);
  } else if (path instanceof GeoPolyLine) {
    param.intervalMin = 0; param.intervalMax = path.vertices.length - 1;
    algo = new AlgoPointOnPolyLine(kernel, path, param);
  }
  if (!algo) return null;

  const point = algo.getOutput();
  point.label = kernel.getConstruction().getNextPointLabel();

  kernel.getConstruction().addElement(param);
  kernel.getConstruction().addElement(algo);
  kernel.getConstruction().addElement(point);
  algo.updateParameter(screenX, screenY);
  algo.compute();
  kernel.notifyUpdate(point);
  return { param, point, algo };
}
