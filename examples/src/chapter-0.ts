const main = async () => {
  if (!navigator.gpu) {
    throw new Error("please enable WebGPU");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("failed to get adapter");
  }

  const presentFormat = navigator.gpu.getPreferredCanvasFormat();
  const device = await adapter.requestDevice();

  const canvas = document.querySelector("canvas");
  if (!canvas) {
    throw new Error("cannot find canvas element");
  }
  const ctx = canvas.getContext("webgpu");
  if (!ctx) {
    throw new Error("failed to get webgpu context");
  }
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

  device.queue.submit([cmdBuffer]);
};

main();

export {};
