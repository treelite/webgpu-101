export const initWebGPU = async (canvas: HTMLCanvasElement | null) => {
  if (!canvas) {
    throw new Error("cannot find canvas element");
  }

  if (!navigator.gpu) {
    throw new Error("please enable WebGPU");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("failed to get adapter");
  }

  const presentFormat = navigator.gpu.getPreferredCanvasFormat();
  const device = await adapter.requestDevice();

  const ctx = canvas.getContext("webgpu");
  if (!ctx) {
    throw new Error("failed to get webgpu context");
  }

  const view = {
    width: canvas.width * devicePixelRatio,
    height: canvas.height * devicePixelRatio,
  };

  // Reset canvas's size to include the devicePixelRatio
  canvas.style.width = canvas.width + "px";
  canvas.style.height = canvas.height + "px";
  canvas.width = view.width;
  canvas.height = view.height;

  ctx.configure({
    device,
    format: presentFormat,
    alphaMode: "premultiplied",
  });

  return { device, ctx, presentFormat, view };
};

export const requestNextAnimiationFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

interface TypedArray {
  buffer: ArrayBufferLike;
}

export const createBufferWithData = (device: GPUDevice, usage: GPUBufferUsageFlags, data: TypedArray) => {
  const buffer = device.createBuffer({
    size: data.buffer.byteLength,
    usage: usage | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  // Copy data by byte
  new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer));
  buffer.unmap();

  return buffer;
};

export const loadImage = async (src: string) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  return createImageBitmap(img);
};

const parseObj = (source: string) => {
  const lines = source.split(/\r?\n+/);
  const vertices: Array<number[]> = [];
  const index: Array<number[]> = [];
  const normal: Array<number[]> = [];

  // Only pick up vertex position("v"), normal("vn") and index("f")
  for (const line of lines) {
    if (line.startsWith("v ")) {
      vertices.push(line.substring(2).split(" ").map(parseFloat));
    } else if (line.startsWith("vn ")) {
      normal.push(line.substring(3).split(" ").map(parseFloat));
    } else if (line.startsWith("f ")) {
      // Collect index based on face
      const values = line.substring(2).split(" ");
      const res = [];
      for (let i = 0; i < values.length; i++) {
        const value = values[i].split("/").map(v => parseInt(v, 10) - 1);
        res.push(value);
      }
      // Change 4-sided face to 3-sided face
      if (res.length > 3) {
        res.splice(2, 0, res[2]);
        res.push(res[0]);
      }
      index.push(...res);
    }
  }

  // Merge vertex position and normal,
  // rebuild the index
  const vertexData = [];
  const indexData = [];
  const indexMap: Map<string, number> = new Map();
  let vertexCount = 0;
  for (const item of index) {
    const vertexIndex = item[0];
    const normalIndex = item[2];
    const key = `${vertexIndex}|${normalIndex}`;
    if (!indexMap.has(key)) {
      vertexData.push(...vertices[vertexIndex]);
      vertexData.push(...normal[normalIndex]);
      indexMap.set(key, vertexCount++);
    }
    indexData.push(indexMap.get(key)!);
  }

  return {
    vertices: new Float32Array(vertexData),
    vertexIndex: new Uint16Array(indexData),
  };
};

export const loadObj = async (src: string) => {
  const res = await fetch(src);
  if (!res.ok) {
    throw new Error(`cannot fetch ${src}`);
  }

  return parseObj(await res.text());
};
