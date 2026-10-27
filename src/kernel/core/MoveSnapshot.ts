/**
 * 拖拽 undo 快照（对标官方 EuclidianController 每种 MoveMode 拖拽结束
 * 统一 storeUndo）：捕获可拖动对象的全部自由形态，供 move 命令回滚。
 *
 * 覆盖：独立点/3D 点坐标、数值、依赖函数的纯 RHS 表达式（moveFunction）、
 * 独立直线方程系数（moveLine）、独立圆锥系数（moveConic）、独立向量分量（moveVector）。
 * 纯函数、无 React 依赖——GeometryCanvas 的 captureState/restoreState 委托于此，
 * 单测直接覆盖（此前浏览器实测发现函数拖拽后撤销按钮回滚失效无法定位，提为纯模块）。
 */
import { Kernel } from './Kernel';
import { GeoElement } from '../geo/GeoElement';
import { GeoPoint } from '../geo/GeoPoint';
import { GeoPoint3D } from '../geo/GeoPoint3D';
import { GeoNumeric } from '../geo/GeoNumeric';
import { GeoLine } from '../geo/GeoLine';
import { GeoConic } from '../geo/GeoConic';
import { GeoArc } from '../geo/GeoArc';
import { GeoConicPart } from '../geo/GeoConicPart';
import { GeoVector } from '../geo/GeoVector';
import { GeoFunction } from '../geo/GeoFunction';
import { AlgoDependentFunction } from '../algo/AlgoDependentFunction';
import { parseExpression } from '../algebra/ExpressionParser';

export type FreeFormKind = 'line' | 'conic' | 'vector';

export interface FreeFormSnapshot {
  kind: FreeFormKind;
  data: number[];
}

export interface MoveSnapshot {
  coords: Map<string, { x: number; y: number; z: number }>;
  numerics: Map<string, number>;
  functions: Map<string, string>;
  freeForms: Map<string, FreeFormSnapshot>;
}

export function captureMoveState(kernel: Kernel): MoveSnapshot {
  const coords = new Map<string, { x: number; y: number; z: number }>();
  const numerics = new Map<string, number>();
  const functions = new Map<string, string>();
  const freeForms = new Map<string, FreeFormSnapshot>();
  kernel.getConstruction().getElements().forEach(el => {
    if ((el instanceof GeoPoint || el instanceof GeoPoint3D) && el.isIndependent()) {
      coords.set(el.id, { x: el.getX(), y: el.getY(), z: el.getZ() });
    } else if (el instanceof GeoNumeric) {
      numerics.set(el.id, el.getValue());
    } else if (el instanceof GeoFunction && el.parentAlgo?.getClassName() === 'AlgoDependentFunction') {
      functions.set(el.id, (el.parentAlgo as AlgoDependentFunction).getExpressionText());
    } else if (el instanceof GeoLine && !el.parentAlgo) {
      freeForms.set(el.id, { kind: 'line', data: [el.a, el.b, el.c] });
    } else if (el instanceof GeoConic && !el.parentAlgo && !(el instanceof GeoArc) && !(el instanceof GeoConicPart)) {
      freeForms.set(el.id, { kind: 'conic', data: [...el.coeffs] });
    } else if (el instanceof GeoVector && !el.parentAlgo) {
      freeForms.set(el.id, { kind: 'vector', data: [el.startX, el.startY, el.endX, el.endY] });
    }
  });
  return { coords, numerics, functions, freeForms };
}

/** 两份快照是否有差异（拖拽 mouseup 的 moved 判定）。 */
export function moveStateChanged(a: MoveSnapshot, b: MoveSnapshot): boolean {
  for (const [id, c] of b.coords) {
    const old = a.coords.get(id);
    if (old && (old.x !== c.x || old.y !== c.y || old.z !== c.z)) return true;
  }
  for (const [id, v] of b.numerics) {
    const old = a.numerics.get(id);
    if (old !== undefined && old !== v) return true;
  }
  for (const [id, t] of b.functions) {
    if (a.functions.get(id) !== t) return true;
  }
  for (const [id, ff] of b.freeForms) {
    const old = a.freeForms.get(id);
    if (old && (old.kind !== ff.kind || old.data.some((v, i) => v !== ff.data[i]))) return true;
  }
  return false;
}

/**
 * 把快照写回构造（undo/redo 的 restore）。返回是否发生任何写回——
 * 调用方据以决定是否触发全场重算。
 */
export function restoreMoveState(kernel: Kernel, state: MoveSnapshot): boolean {
  let touched = false;
  state.coords.forEach((c, id) => {
    const el = kernel.getConstruction().getElementById(id);
    if (el instanceof GeoPoint) { el.setCoords(c.x, c.y, c.z); touched = true; }
    else if (el instanceof GeoPoint3D) { el.setCoords(c.x, c.y, c.z); touched = true; }
  });
  state.numerics.forEach((val, id) => {
    const el = kernel.getConstruction().getElementById(id);
    if (el instanceof GeoNumeric) { el.setValue(val); touched = true; }
  });
  state.functions.forEach((text, id) => {
    const el = kernel.getConstruction().getElementById(id);
    if (!(el instanceof GeoFunction) || el.parentAlgo?.getClassName() !== 'AlgoDependentFunction') return;
    const algo = el.parentAlgo as AlgoDependentFunction;
    if (algo.getExpressionText() === text) return;
    try {
      algo.replaceDefinition(parseExpression(text), text);
      touched = true;
    } catch { /* 快照文本应恒可解析；防御式跳过 */ }
  });
  state.freeForms.forEach((ff, id) => {
    const el = kernel.getConstruction().getElementById(id);
    if (ff.kind === 'line' && el instanceof GeoLine && !el.parentAlgo) {
      [el.a, el.b, el.c] = ff.data;
      el.update();
      touched = true;
    } else if (ff.kind === 'conic' && el instanceof GeoConic && !el.parentAlgo && ff.data.length === 6) {
      for (let i = 0; i < 6; i++) el.coeffs[i] = ff.data[i];
      el.update();
      touched = true;
    } else if (ff.kind === 'vector' && el instanceof GeoVector && !el.parentAlgo) {
      [el.startX, el.startY, el.endX, el.endY] = ff.data;
      el.update();
      touched = true;
    }
  });
  return touched;
}
