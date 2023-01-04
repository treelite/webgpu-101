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
