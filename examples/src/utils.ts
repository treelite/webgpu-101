export const initWebGPU = async (canvas: HTMLCanvasElement) => {
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
  ctx.configure({
    device,
    format: presentFormat,
    alphaMode: "premultiplied",
  });

  return { device, ctx, presentFormat };
};
