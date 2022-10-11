/**
 * Render an empty canvas with blue background
 */

const main = async (canvas: HTMLCanvasElement | null) => {
  // Check whether the webgpu feature is enabled in browser
  if (!navigator.gpu) {
    throw new Error("please enable WebGPU");
  }

  // Create adapter
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("failed to get adapter");
  }

  const presentFormat = navigator.gpu.getPreferredCanvasFormat();
  // Create device
  const device = await adapter.requestDevice();

  if (!canvas) {
    throw new Error("cannot find canvas element");
  }
  const ctx = canvas.getContext("webgpu");
  if (!ctx) {
    throw new Error("failed to get webgpu context");
  }
  // Setup canvas context
  ctx.configure({
    device,
    format: presentFormat,
    alphaMode: "premultiplied",
  });

  const cmdEncoder = device.createCommandEncoder();
  const renderPassEncoder = cmdEncoder.beginRenderPass({
    colorAttachments: [{
      view: ctx.getCurrentTexture().createView(),
      loadOp: "clear",
      storeOp: "store",
      clearValue: { r: 0, g: 0.5, b: 1, a: 1 },
    }],
  });
  renderPassEncoder.end();
  const cmdBuffer = cmdEncoder.finish();

  // Submit command to GPU for execution
  device.queue.submit([cmdBuffer]);
};

export default main;
