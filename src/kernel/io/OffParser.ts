/**
 * OFF（Object File Format）网格解析与导入 —— 对标 GeoGebra OFFHandler。
 *
 * OFF 基本格式：
 *   OFF
 *   # comment
 *   nV nF nE
 *   x y z          × nV
 *   k i0 … i{k-1}  × nF   （k 后可跟 r g b [a] 面颜色）
 *
 * 解析为顶点 + 面索引；导入为自由 GeoMesh3D（不依赖 A3-4 多面体拓扑）。
 */
import { IKernel } from '../core/Interfaces';
import { Coords4 } from '../core/Coords4';
import { GeoMesh3D } from '../geo/GeoMesh3D';

export interface OffMesh {
  vertices: { x: number; y: number; z: number }[];
  faces: number[][];
  /** 可选面颜色（CSS rgb/rgba 字符串），与 faces 等长时有效。 */
  faceColors?: string[];
}

/** 解析 OFF 文本；抛错时给出可读原因。 */
export function parseOFF(text: string): OffMesh {
  const rawLines = text.split(/\r?\n/);
  const lines: string[] = [];
  for (const raw of rawLines) {
    const t = raw.trim();
    if (!t || t.startsWith('#')) continue;
    lines.push(t);
  }
  if (lines.length === 0) throw new Error('OFF: empty file');
  let idx = 0;
  if (/^OFF$/i.test(lines[0])) {
    idx = 1;
  } else if (/^OFF/i.test(lines[0]) && lines[0].length > 3) {
    // OFF 与计数同行：OFF nV nF nE
    const rest = lines[0].slice(3).trim();
    if (rest) lines.splice(0, 1, rest);
  } else {
    throw new Error('OFF: missing OFF header');
  }
  if (idx >= lines.length) throw new Error('OFF: missing counts line');
  const counts = lines[idx].split(/\s+/).map(Number);
  if (counts.length < 2 || !Number.isFinite(counts[0]) || !Number.isFinite(counts[1])) {
    throw new Error('OFF: invalid counts line');
  }
  const nV = Math.floor(counts[0]);
  const nF = Math.floor(counts[1]);
  if (nV < 0 || nF < 0) throw new Error('OFF: negative counts');
  idx++;

  const vertices: OffMesh['vertices'] = [];
  for (let i = 0; i < nV; i++) {
    if (idx >= lines.length) throw new Error(`OFF: truncated vertices (have ${vertices.length}/${nV})`);
    const parts = lines[idx++].split(/\s+/).map(Number);
    if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) {
      throw new Error(`OFF: invalid vertex at index ${i}`);
    }
    vertices.push({ x: parts[0], y: parts[1], z: parts[2] });
  }

  const faces: number[][] = [];
  const faceColors: string[] = [];
  let hasColor = false;
  for (let f = 0; f < nF; f++) {
    if (idx >= lines.length) throw new Error(`OFF: truncated faces (have ${faces.length}/${nF})`);
    const parts = lines[idx++].split(/\s+/);
    const k = Number(parts[0]);
    if (!Number.isInteger(k) || k < 3) throw new Error(`OFF: face ${f} has k=${parts[0]} (need integer ≥3)`);
    if (parts.length < 1 + k) throw new Error(`OFF: face ${f} truncated`);
    const face: number[] = [];
    for (let j = 0; j < k; j++) {
      const vi = Number(parts[1 + j]);
      if (!Number.isInteger(vi) || vi < 0 || vi >= nV) {
        throw new Error(`OFF: face ${f} vertex index ${parts[1 + j]} out of range`);
      }
      face.push(vi);
    }
    faces.push(face);
    // 可选颜色：k 后 1~4 个整数分量，或 3 个 [0,1] 浮点分量
    const colorParts = parts.slice(1 + k);
    if (colorParts.length >= 1) {
      const nums = colorParts.map(Number);
      if (nums.every(n => Number.isFinite(n)) && nums.length >= 3) {
        hasColor = true;
        if (nums.every(n => n <= 1 && !Number.isInteger(nums[0]) || n <= 1 && Number.isInteger(n) === false)) {
          // 浮点 [0,1]
          faceColors.push(`rgba(${Math.round(nums[0] * 255)},${Math.round(nums[1] * 255)},${Math.round(nums[2] * 255)},${nums.length > 3 ? nums[3] : 1})`);
        } else {
          // 整数 0–255（或 packed）：取前三个 0–255 解释
          const r = Math.min(255, Math.max(0, Math.round(nums[0])));
          const g = Math.min(255, Math.max(0, Math.round(nums[1] > 255 ? nums[1] & 0xff : nums[1])));
          const b = Math.min(255, Math.max(0, Math.round(nums[2] > 255 ? nums[2] & 0xff : nums[2])));
          faceColors.push(`rgb(${r},${g},${b})`);
        }
      } else {
        faceColors.push('');
      }
    } else {
      faceColors.push('');
    }
  }

  return {
    vertices,
    faces,
    faceColors: hasColor ? faceColors : undefined,
  };
}

/** 把 OFF 网格导入构造：创建一个自由 GeoMesh3D 并入构造。 */
export function importOFF(kernel: IKernel, text: string, label?: string): GeoMesh3D {
  const mesh = parseOFF(text);
  const el = new GeoMesh3D(kernel);
  el.setMesh(
    mesh.vertices.map(v => Coords4.fromPoint(v.x, v.y, v.z)),
    mesh.faces,
  );
  if (mesh.faceColors) el.faceColors = mesh.faceColors;
  if (label !== undefined && label !== '') {
    el.label = label;
  } else {
    const meshCount = kernel.getConstruction().getElements()
      .filter(e => (e as { label?: string }).label?.startsWith('mesh')).length;
    el.label = meshCount === 0 ? 'mesh' : `mesh${meshCount}`;
  }
  kernel.getConstruction().addElement(el);
  kernel.getConstruction().updateAllAlgorithms();
  return el;
}
