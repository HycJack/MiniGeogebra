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
import { GeoFunction } from '../../kernel/geo/GeoFunction';
import { GeoRay } from '../../kernel/geo/GeoRay';
import { GeoPolyLine } from '../../kernel/geo/GeoPolyLine';
import { GeoArc } from '../../kernel/geo/GeoArc';
import { GeoCurve } from '../../kernel/geo/GeoCurve';
import { GeoVec3D } from '../../kernel/core/GeoVec3D';
import { AlgoElement } from '../../kernel/algo/AlgoElement';
import { AlgoPointOnSegment } from '../../kernel/algo/AlgoPointOnSegment';
import { AlgoPointOnLine } from '../../kernel/algo/AlgoPointOnLine';
import { AlgoPointOnConic } from '../../kernel/algo/AlgoPointOnConic';
import { AlgoPointOnPolyLine } from '../../kernel/algo/AlgoPointOnPolyLine';
import { AlgoPointOnRay } from '../../kernel/algo/AlgoPointOnRay';
import { AlgoPointOnArc } from '../../kernel/algo/AlgoPointOnArc';import { AlgoPointOnCurve } from '../../kernel/algo/AlgoCurveFamily';
import { AlgoPointOnFunction } from '../../kernel/algo/AlgoPointOnFunction';

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

/**
 * 测量标签：对齐 GeoGebra 的命名习惯——距离/面积走数值字符表（a, b, c…），
 * 角度走希腊字母表（α, β, γ…，无 π），全部查重唯一（此前 d{n}/∠/S 会撞名）。
 */
export function nextDistanceLabel(construction: Construction): string {
  return construction.getNextNumericLabel();
}

/** 为角度测量生成唯一数值标签（希腊字母序列）。 */
export function nextAngleLabel(construction: Construction): string {
  return construction.getNextAngleLabel();
}

/** 为面积测量生成唯一数值标签。 */
export function nextAreaLabel(construction: Construction): string {
  return construction.getNextNumericLabel();
}

/** 在路径（线段/直线/圆/折线）上根据屏幕位置创建一个带参数的约束点。 */
export function createParameterPointOnPath(
  kernel: Kernel,
  path: GeoSegment | GeoLine | GeoRay | GeoConic | GeoPolyLine | GeoArc | GeoCurve,
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
  } else if (path instanceof GeoRay) {
    // 射线：t 为距原点弧长（AlgoPointOnRay 内部夹取 t≥0）
    param.intervalMin = 0; param.intervalMax = 10;
    algo = new AlgoPointOnRay(kernel, path, param);
  } else if (path instanceof GeoPolyLine) {
    param.intervalMin = 0; param.intervalMax = path.vertices.length - 1;
    algo = new AlgoPointOnPolyLine(kernel, path, param);
  } else if (path instanceof GeoArc) {
    // 圆弧参数 = 起止角区间（Path 接口与圆锥曲线同构）
    param.intervalMin = path.getStartAngle();
    param.intervalMax = path.getEndAngle();
    param.animationIncrement = 0;
    algo = new AlgoPointOnArc(kernel, path, param);
  } else if (path instanceof GeoCurve) {
    // 参数曲线：参数区间即定义域
    param.intervalMin = path.getMinParameter();
    param.intervalMax = path.getMaxParameter();
    algo = new AlgoPointOnCurve(kernel, path, param);
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

/**
 * 在函数曲线上根据点击位置创建一个带参数的约束点。
 * 参数（x 值）必须带唯一标签，否则代数视图与滑块面板里是个无名数值。
 */
export function createParameterPointOnFunction(
  kernel: Kernel,
  fn: GeoFunction,
  x: number,
  domain?: { min: number; max: number },
): { param: GeoNumeric; point: GeoPoint; algo: AlgoPointOnFunction } {
  const param = new GeoNumeric(kernel, x);
  param.label = kernel.getConstruction().getNextNumericLabel();
  // 参数区间 = 函数所在视口 x 范围（此前沿用默认 [0, 2π]，与函数定义域无关，
  // 约束点动画/拖拽的可用范围完全错误）
  if (domain && Number.isFinite(domain.min) && Number.isFinite(domain.max)) {
    param.intervalMin = domain.min;
    param.intervalMax = domain.max;
  } else {
    param.intervalMin = -100;
    param.intervalMax = 100;
  }

  const algo = new AlgoPointOnFunction(kernel, fn, param);
  const point = algo.getOutput();

  kernel.getConstruction().addElement(param);
  kernel.getConstruction().addElement(algo);
  kernel.getConstruction().addElement(point);
  algo.update();
  kernel.notifyUpdate(point);
  return { param, point, algo };
}
