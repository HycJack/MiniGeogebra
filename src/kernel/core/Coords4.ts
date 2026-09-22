/**
 * 3D 齐次坐标 —— 对标 GeoGebra 的 kernel/matrix/Coords。
 *
 * 约定：点 (x, y, z, 1)，方向/向量 (x, y, z, 0)。四元组按 [x, y, z, w] 存储。
 * 全部为纯值语义（不可变），与 2D 的 GeoVec3D 互补（后者是 2D 齐次坐标）。
 */

export class Coords4 {
  constructor(
    public readonly x: number,
    public readonly y: number,
    public readonly z: number,
    public readonly w: number,
  ) {}

  static origin(): Coords4 { return new Coords4(0, 0, 0, 1); }

  static fromPoint(x: number, y: number, z: number): Coords4 {
    return new Coords4(x, y, z, 1);
  }

  static fromDirection(x: number, y: number, z: number): Coords4 {
    return new Coords4(x, y, z, 0);
  }

  isPoint(): boolean { return Math.abs(this.w) > 1e-12; }
  isDirection(): boolean { return !this.isPoint(); }

  /** 归一到 w=1（仅对点有意义）。 */
  toPoint(): Coords4 {
    if (!this.isPoint()) return this;
    return new Coords4(this.x / this.w, this.y / this.w, this.z / this.w, 1);
  }

  getX(): number { return this.isPoint() ? this.x / this.w : this.x; }
  getY(): number { return this.isPoint() ? this.y / this.w : this.y; }
  getZ(): number { return this.isPoint() ? this.z / this.w : this.z; }

  /** 方向部分（丢弃 w）。 */
  asDirection(): Coords4 { return new Coords4(this.x, this.y, this.z, 0); }

  add(other: Coords4): Coords4 {
    return new Coords4(this.x + other.x, this.y + other.y, this.z + other.z, this.w + other.w);
  }

  sub(other: Coords4): Coords4 {
    return new Coords4(this.x - other.x, this.y - other.y, this.z - other.z, this.w - other.w);
  }

  scale(factor: number): Coords4 {
    return new Coords4(this.x * factor, this.y * factor, this.z * factor, this.w);
  }

  /** 向量点积（忽略 w）。 */
  dot(other: Coords4): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  /** 向量叉积（仅方向部分有意义）。 */
  cross(other: Coords4): Coords4 {
    return new Coords4(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x,
      0,
    );
  }

  normSquared(): number { return this.dot(this); }
  norm(): number { return Math.sqrt(this.normSquared()); }

  /** 归一化为单位方向（零向量返回自身）。 */
  normalize(): Coords4 {
    const n = this.norm();
    if (n < 1e-14) return this;
    return new Coords4(this.x / n, this.y / n, this.z / n, 0);
  }

  distanceTo(other: Coords4): number {
    return this.sub(other).norm();
  }

  toString(): string {
    return `(${this.getX()}, ${this.getY()}, ${this.getZ()})`;
  }
}
