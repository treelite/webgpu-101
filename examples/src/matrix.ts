/**
 * A 4x4 Matrix
 */
export class Matrix4 {
  private data: number[];

  constructor(data?: number[]) {
    this.data = data || [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  }

  private reverse() {
    const res: number[] = [];
    for (let i = 0; i < 16; i++) {
      res[i] = this.data[i % 4 * 4 + Math.floor(i / 4)];
    }

    return res;
  }

  public setTranslate(x: number, y: number, z: number) {
    this.data = [
      1, 0, 0, x,
      0, 1, 0, y,
      0, 0, 1, z,
      0, 0, 0, 1,
    ];
    return this;
  };

  public setScale(x: number, y: number, z: number) {
    this.data = [
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1,
    ];
    return this;
  };

  public setRotateZ(angle: number) {
    const radian = Math.PI * angle / 180;
    const cos = Math.cos(radian);
    const sin = Math.sin(radian);
    this.data = [
      cos, -1 * sin, 0, 0,
      sin, cos, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    return this;
  }

  public setRotateX(angle: number) {
    const radian = Math.PI * angle / 180;
    const cos = Math.cos(radian);
    const sin = Math.sin(radian);
    this.data = [
      1, 0, 0, 0,
      0, sin, cos, 0,
      0, cos, -1 * sin, 0,
      0, 0, 0, 1,
    ];
    return this;
  }

  public setRotateY(angle: number) {
    const radian = Math.PI * angle / 180;
    const cos = Math.cos(radian);
    const sin = Math.sin(radian);
    this.data = [
      cos, 0, sin, 0,
      0, 1, 0, 0,
      -1 *sin, 0, cos, 0,
      0, 0, 0, 1,
    ];
    return this;
  }

  public multiply(m: Matrix4) {
    const res:number[] = [];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        res[i * 4 + j] = this.data[i * 4 + 0] * m.data[j]
          + this.data[i * 4 + 1] * m.data[4 + j]
          + this.data[i * 4 + 2] * m.data[8 + j]
          + this.data[i * 4 + 3] * m.data[12 + j];
      }
    }
    return new Matrix4(res);
  }

  public toWebGPUMatrix() {
    return new Float32Array(this.reverse());
  }

  public translate(x: number, y: number, z: number) {
    return this.multiply((new Matrix4()).setTranslate(x, y, z));
  }

  public scale(x: number, y: number, z: number) {
    return this.multiply((new Matrix4()).setScale(x, y, z));
  }

  public rotateZ(angle: number) {
    return this.multiply((new Matrix4()).setRotateZ(angle));
  }

  public rotateY(angle: number) {
    return this.multiply((new Matrix4()).setRotateY(angle));
  }

  public rotateX(angle: number) {
    return this.multiply((new Matrix4()).setRotateX(angle));
  }
}
