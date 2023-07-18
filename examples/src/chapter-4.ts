/**
 * Render a cube with image texture
 */
import { initWebGPU, createBufferWithData, loadImage, requestNextAnimiationFrame } from "./utils";
import { Matrix4 } from "./matrix";

const vertexSourceCode = `
  struct Result {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
  }

  @group(0) @binding(0)
  var<uniform> modelViewMatrix: mat4x4<f32>;

  @vertex
  fn main(@location(0) position: vec3<f32>, @location(1) uv: vec2<f32>) -> Result {
    var res: Result;
    res.position = modelViewMatrix * vec4(position, 1.0);
    res.uv = uv;
    return res;
  }
`;

const fragmentSourceCode = `
  @group(0) @binding(1)
  var t: texture_2d<f32>;

  @group(0) @binding(2)
  var s: sampler;

  @fragment
  fn main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
    return textureSample(t, s, uv);
  }
`;

const vertices = new Float32Array([
  // x, y, z, u, v
  // Front
  -1, 1, 1, 0, 0,
  1, 1, 1, 1, 0,
  1, -1, 1, 1, 1,
  -1, -1, 1, 0, 1,

  // Back
  1, 1, -1, 0, 0,
  -1, 1, -1, 1, 0,
  -1, -1, -1, 1, 1,
  1, -1, -1, 0, 1,

  // Left
  1, 1, 1, 0, 0,
  1, 1, -1, 1, 0,
  1, -1, -1, 1, 1,
  1, -1, 1, 0, 1,

  // Right
  -1, 1, -1, 0, 0,
  -1, 1, 1, 1, 0,
  -1, -1, 1, 1, 1,
  -1, -1, -1, 0, 1,

  // Top
  -1, 1, -1, 0, 0,
  1, 1, -1, 1, 0,
  1, 1, 1, 1, 1,
  -1, 1, 1, 0, 1,

  // Bottom
  -1, -1, 1, 0, 0,
  1, -1, 1, 1, 0,
  1, -1, -1, 1, 1,
  -1, -1, -1, 0, 1,
]);

/*
const vertices = new Float32Array([
  // x, y, z, u, v
  -1, 1, 1, 0, 1,
  1, 1, 1, 1, 1,
  1, -1, 1, 1, 0,
  -1, -1, 1, 0, 0,
  -1, 1, -1, 0, 0,
  1, 1, -1, 1, 0,
  1, -1, -1, 1, 1,
  -1, -1, -1, 0, 1,
]);
*/

const vertexIndex = new Uint16Array([
  // Front
  0, 1, 2,
  2, 3, 0,

  // Back
  4, 5, 6,
  6, 7, 4,

  // Left
  8, 9, 10,
  10, 11, 8,

  // Right
  12, 13, 14,
  14, 15, 12,

  // Top
  16, 17, 18,
  18, 19, 16,

  // Bottom
  20, 21, 22,
  22, 23, 20,
]);

const main = async (canvas: HTMLCanvasElement | null) => {
  const { device, ctx, presentFormat, view } = await initWebGPU(canvas);
  const textureImg = await loadImage("./assets/webgpu.png");

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
        format: "float32x2",
      },
    ],
    arrayStride: 20,
    stepMode: "vertex",
  };

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
    ],
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

  const texture = device.createTexture({
    size: [textureImg.width, textureImg.height],
    format: presentFormat,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sampler = device.createSampler();

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: modelViewMatrixBuffer,
        },
      },
      {
        binding: 1,
        resource: texture.createView(),
      },
      {
        binding: 2,
        resource: sampler,
      },
    ],
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
      .rotateX(angle)
      .rotateY(angle)
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
    device.queue.copyExternalImageToTexture({ source: textureImg }, { texture }, [textureImg.width, textureImg.height])
    device.queue.submit([cmdEncoder.finish()]);

    await requestNextAnimiationFrame();
    render(now, angle);
  };

  await render(Date.now(), 0);
}

export default main;
