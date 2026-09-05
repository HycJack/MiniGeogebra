/**
 * NavigationCube —— 右上角的 3D 方向指示器。
 *
 * 绘制一个微型立方体，其朝向与主视图同步旋转，
 * 用户可点击各面跳转到对应的预设视图。
 */

import React, { useCallback, useRef, useEffect } from 'react';
import type { StandardView, ProjectionMode } from '../kernel/view/WebGL3DRenderer';

interface Props {
  yaw: number;
  pitch: number;
  onSetView: (view: StandardView) => void;
}

const SIZE = 80;       // canvas CSS size
const CUBE = 24;       // cube half-edge in canvas pixels
const DPR = 2;         // device pixel ratio

/** 立方体面定义：世界空间法线 + 颜色 + 标签 + 点击视图。 */
const FACES: { nx: number; ny: number; nz: number; color: string; label: string; view: StandardView }[] = [
  { nx: 1, ny: 0, nz: 0, color: '#fca5a5', label: 'X',  view: 'yz' },   // +X 面（红）
  { nx: -1, ny: 0, nz: 0, color: '#fecaca', label: '', view: 'yz' },   // -X
  { nx: 0, ny: 1, nz: 0, color: '#86efac', label: 'Y', view: 'xz' },   // +Y 面（绿）
  { nx: 0, ny: -1, nz: 0, color: '#bbf7d0', label: '', view: 'xz' },   // -Y
  { nx: 0, ny: 0, nz: 1, color: '#93c5fd', label: 'Z', view: 'xy' },   // +Z 面（蓝）
  { nx: 0, ny: 0, nz: -1, color: '#bfdbfe', label: '', view: 'home' }, // -Z
];

function rotateY(v: [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

function rotateX(v: [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function rotateZ(v: [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

/** 立方体 8 个顶点（±CUBE）。 */
const VERTS: [number, number, number][] = [
  [-CUBE, -CUBE, -CUBE],
  [ CUBE, -CUBE, -CUBE],
  [-CUBE,  CUBE, -CUBE],
  [ CUBE,  CUBE, -CUBE],
  [-CUBE, -CUBE,  CUBE],
  [ CUBE, -CUBE,  CUBE],
  [-CUBE,  CUBE,  CUBE],
  [ CUBE,  CUBE,  CUBE],
];

function applyRot(v: [number, number, number], yaw: number, pitch: number): [number, number, number] {
  let r = rotateZ(v, yaw);
  r = rotateX(r, -pitch);
  return r;
}

function project3Dto2D(v: [number, number, number], cx: number, cy: number): [number, number] {
  // 简单透视投影
  const fov = 200;
  const z = v[2] + 200;
  const scale = z > 1 ? fov / z : fov;
  return [cx + v[0] * scale, cy - v[1] * scale];
}

export const NavigationCube: React.FC<Props> = ({ yaw, pitch, onSetView }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = SIZE * DPR;
    const h = SIZE * DPR;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // 变换所有顶点
    const tv = VERTS.map(v => applyRot(v, yaw, pitch));

    // 计算每个面的深度（用于排序）
    const faceData = FACES.map((face, fi) => {
      // 面的 4 个顶点索引
      const vi = [0, 1, 3, 2]; // 标准面
      // 根据法线选择正确的顶点组
      let indices: number[];
      if (fi === 0) indices = [1, 5, 7, 3];       // +X
      else if (fi === 1) indices = [0, 2, 6, 4];   // -X
      else if (fi === 2) indices = [2, 3, 7, 6];   // +Y
      else if (fi === 3) indices = [0, 4, 5, 1];   // -Y
      else if (fi === 4) indices = [4, 5, 7, 6];   // +Z
      else indices = [0, 1, 3, 2];                 // -Z

      const pts2d = indices.map(i => project3Dto2D(tv[i], cx, cy));
      const avgZ = indices.reduce((s, i) => s + tv[i][2], 0) / 4;
      return { face, pts2d, avgZ, indices };
    });

    // 按深度排序（远处先画）
    faceData.sort((a, b) => a.avgZ - b.avgZ);

    // 绘制面
    for (const fd of faceData) {
      ctx.beginPath();
      ctx.moveTo(fd.pts2d[0][0], fd.pts2d[0][1]);
      for (let i = 1; i < fd.pts2d.length; i++) {
        ctx.lineTo(fd.pts2d[i][0], fd.pts2d[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = fd.face.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 标签
      if (fd.face.label) {
        const lx = fd.pts2d.reduce((s, p) => s + p[0], 0) / 4;
        const ly = fd.pts2d.reduce((s, p) => s + p[1], 0) / 4;
        ctx.font = `bold ${11 * DPR}px sans-serif`;
        ctx.fillStyle = '#374151';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fd.face.label, lx, ly);
      }
    }
  }, [yaw, pitch]);

  useEffect(() => { draw(); }, [draw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * DPR - SIZE * DPR / 2;
    const y = -(e.clientY - rect.top) * DPR + SIZE * DPR / 2;
    // 简单判断：点击上半部分 → 顶视图，下半部分 → 正视图，左半 → 侧视
    if (Math.abs(x) < 10 && Math.abs(y) < 10) return; // 中心不触发
    if (y > 10) onSetView('xy');
    else if (y < -10 && Math.abs(x) < 10) onSetView('xz');
    else if (x > 10) onSetView('yz');
    else onSetView('home');
  }, [onSetView]);

  return (
    <canvas
      ref={canvasRef}
      width={SIZE * DPR}
      height={SIZE * DPR}
      style={{ width: SIZE, height: SIZE }}
      className="cursor-pointer"
      onClick={handleClick}
      title="点击切换视图"
    />
  );
};

export default NavigationCube;
