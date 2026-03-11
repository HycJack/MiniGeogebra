export class GeoVec3D {
  constructor(
    public x: number,
    public y: number,
    public z: number = 1,
  ) {}

  set(x: number, y: number, z: number = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  getXML(): string {
    return `<coords x="${this.x}" y="${this.y}" z="${this.z}" />`;
  }
}
