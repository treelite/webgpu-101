export class Vector3 {
  private x: number;
  private y: number;
  private z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  public multiply(v: Vector3) {
    const x = this.y * v.z - this.z * v.y;
    const y = this.z * v.x - this.x * v.z;
    const z = this.x * v.y - this.y * v.x;

    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  public toArray() {
    return [this.x, this.y, this.z];
  }
}
