/**
 * A 4x4 Matrix
 */
export class Matrix4 {
  private data: number[];

  constructor() {
    this.data = [
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
      0, cos, -1 * sin, 0,
      0, sin, cos, 0,
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

  // https://github.com/yukoba/WebGLBook/blob/master/lib/cuon-matrix.js
  public setLookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number]) {
    let fx = target[0] - eye[0];
    let fy = target[1] - eye[1];
    let fz = target[2] - eye[2];

    let rlf = 1 / Math.sqrt(fx*fx + fy*fy + fz*fz);
    fx *= rlf;
    fy *= rlf;
    fz *= rlf;

    let sx = fy * up[2] - fz * up[1];
    let sy = fz * up[0] - fx * up[2];
    let sz = fx * up[1] - fy * up[0];

    let rls = 1 / Math.sqrt(sx*sx + sy*sy + sz*sz);
    sx *= rls;
    sy *= rls;
    sz *= rls;

    let ux = sy * fz - sz * fy;
    let uy = sz * fx - sx * fz;
    let uz = sx * fy - sy * fx;

    this.data = [
      sx, sy, sz, 0,
      ux, uy, uz, 0,
      -fx, -fy, -fz, 0,
      0, 0, 0, 1,
    ];

    return this.translate(-eye[0], -eye[1], -eye[2]);
  }

  // https://github.com/yukoba/WebGLBook/blob/master/lib/cuon-matrix.js
  public setPerspective(fov: number, aspect: number, near: number, far: number) {
    if (near === far || aspect === 0) {
        throw new Error("null frustum");
    }
    if (near <= 0) {
        throw new Error("near <= 0");
    }
    if (far <= 0) {
        throw new Error("far <= 0");
    }

    fov = Math.PI * fov / 180 / 2;
    let s = Math.sin(fov);
    if (s === 0) {
        throw new Error("null frustum");
    }

    let rd = 1 / (far - near);
    let ct = Math.cos(fov) / s;

    this.data = [
      ct / aspect, 0, 0, 0,
      0, ct, 0, 0,
      0, 0, -(far + near) * rd, -2 * near * far * rd,
      0, 0, -1, 0,
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
    this.data = res;
    return this;
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

  public lookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number]) {
    return this.multiply((new Matrix4()).setLookAt(eye, target, up));
  }
}
