/**
 * 3D 视图状态存档通道（L5-2）：
 * Geometry3DView 持有相机（yaw/pitch/dist/target）与投影/网格状态，而序列化
 * 发生在 GeometryCanvas 的导出流程——组件间不共享 state，用注册器 +
 * 待消费槽做单向桥接：
 *   - 导出时 snapshotView3D() 取当前 3D 视图快照（未挂载 3D 视图 → null）；
 *   - 导入时 offerView3D(snapshot)，Geometry3DView 挂载后 consumeView3D() 恢复。
 */

export interface View3DStateSnapshot {
  yaw: number;
  pitch: number;
  dist: number;
  target: [number, number, number];
  projection: 'perspective' | 'orthographic';
  grid: boolean;
  axes: boolean;
  clipBox: boolean;
}

let accessor: (() => View3DStateSnapshot | null) | null = null;
let pending: View3DStateSnapshot | null = null;

/** Geometry3DView 挂载时注册实时快照读取器，卸载时注销。 */
export function registerView3D(a: (() => View3DStateSnapshot | null) | null): void {
  accessor = a;
}

/** 序列化时取当前 3D 视图状态；3D 视图未挂载（从未打开/已关闭）返回 null。 */
export function snapshotView3D(): View3DStateSnapshot | null {
  return accessor ? accessor() : null;
}

/** 反序列化后存入待恢复快照，Geometry3DView 下次挂载时消费。 */
export function offerView3D(s: View3DStateSnapshot): void {
  pending = s;
}

/** Geometry3DView 挂载时取走待恢复快照（一次性）。 */
export function consumeView3D(): View3DStateSnapshot | null {
  const p = pending;
  pending = null;
  return p;
}
