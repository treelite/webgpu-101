import { initWebGPU, createBufferWithData, requestNextAnimiationFrame } from "./utils";
import { Matrix4 } from "./matrix";

const vertexSourceCode = `
  struct Result {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
  }

  // Bind modelViewMatrix
  @group(0) @binding(0)
  var<uniform> modelViewMatrix: mat4x4<f32>;

  @vertex
  fn main (@location(0) position: vec3<f32>, @location(1) color: vec4<f32>) -> Result {
    var res: Result;
    res.position = modelViewMatrix * vec4(position, 1.0);
    res.color = color;
    return res;
  }
`;

const fragmentSourceCode = `
  @fragment
  fn main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
    return color;
  }
`;

const vertices = new Float32Array([
  -1, 1, 1, 1, 0, 0, 1,
  1, 1, 1, 1, 1, 0, 1,
  1, -1, 1, 0, 1, 1, 1,
  -1, -1, 1, 0, 0, 1, 1,
  -1, 1, -1, 1, 0, 1, 1,
  1, 1, -1, 1, 1, 0, 1,
  1, -1, -1, 0, 1, 0, 1,
  -1, -1, -1, 0, 0, 0, 1,
]);

const vertexIndex = new Uint16Array([
  // Front
  0, 1, 2,
  2, 3, 0,

  // Back
  4, 5, 6,
  6, 7, 4,

  // Left
  4, 0, 3,
  3, 7, 4,

  // Right
  1, 5, 6,
  6, 2, 1,

  // Top
  4, 5, 1,
  1, 0, 4,

  // Bottom
  7, 6, 2,
  2, 3, 7,
]);

const main = async (canvas: HTMLCanvasElement | null) => {
  const { device, ctx, presentFormat, view } = await initWebGPU(canvas);

  const vertexModule = device.createShaderModule({ code: vertexSourceCode });
  const fragmentModule = device.createShaderModule({ code: fragmentSourceCode });

  const vertexBuffer = createBufferWithData(device, GPUBufferUsage.VERTEX, vertices);

  const vertexIndexBuffer = createBufferWithData(device, GPUBufferUsage.INDEX, vertexIndex);
  const modelViewMatrixBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const vertexBufferLayout: GPUVertexBufferLayout = {
    attributes: [
      {
        shaderLocation: 0,
        offset: 0,
        format: "float32x3",
      },
      {
        shaderLocation: 1,
        offset: 12,
        format: "float32x4",
      },
    ],
    arrayStride: 28,
    stepMode: "vertex",
  };

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: {},
    }],
  });

  const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
    }),
    vertex: {
      module: vertexModule,
      entryPoint: "main",
      buffers: [vertexBufferLayout],
    },
    fragment: {
      module: fragmentModule,
      entryPoint: "main",
      targets: [{ format: presentFormat }],
    },
    primitive: {
      topology: "triangle-list",
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: {
        buffer: modelViewMatrixBuffer,
      },
    }],
  });

  const depthTexture = device.createTexture({
    size: view,
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const speed = 0.1;
  const render = async (lastTime: number, lastAngle: number) => {
    const now = Date.now();
    const dt = now - lastTime;
    const angle = lastAngle + dt * speed;

    const modelViewMatrix = (new Matrix4())
      .setPerspective(30, view.width / view.height, 1, 100)
      .lookAt([3, 3, 7], [0, 0, 0], [0, 1, 0])
      .rotateY(angle)
      .rotateX(angle)
      .scale(0.5, 0.5, 0.5);

    const cmdEncoder = device.createCommandEncoder();
    const passEncoder = cmdEncoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    })
    passEncoder.setPipeline(renderPipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setIndexBuffer(vertexIndexBuffer, "uint16");
    passEncoder.setVertexBuffer(0, vertexBuffer);

    passEncoder.drawIndexed(vertexIndex.length);
    passEncoder.end();

    device.queue.writeBuffer(modelViewMatrixBuffer, 0, modelViewMatrix.toWebGPUMatrix());
    device.queue.submit([cmdEncoder.finish()]);

    await requestNextAnimiationFrame();
    render(now, angle);
  };

  await render(Date.now(), 0);
};

export default main;
