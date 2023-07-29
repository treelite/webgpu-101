/**
 * Add lights to cube
 */
import { initWebGPU, createBufferWithData, loadImage, requestNextAnimiationFrame } from "./utils";
import { Matrix4 } from "./matrix";

const vertexSourceCode = `
  struct Result {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) pos: vec3<f32>,
    @location(2) normal: vec3<f32>,
  }

  @group(0) @binding(0)
  var<uniform> projectionMatrix: mat4x4<f32>;

  @group(0) @binding(1)
  var<uniform> modelMatrix: mat4x4<f32>;

  @group(0) @binding(2)
  var<uniform> normalMatrix: mat4x4<f32>;

  @vertex
  fn main(@location(0) position: vec3<f32>, @location(1) uv: vec2<f32>, @location(2) normal: vec3<f32>) -> Result {
    var pos: vec4<f32> = modelMatrix * vec4(position, 1.0);

    var res: Result;
    res.position = projectionMatrix * pos;
    res.pos = pos.xyz;
    res.normal = (normalMatrix * vec4(normal, 1.0)).xyz;
    res.uv = uv;
    return res;
  }
`;

const fragmentSourceCode = `
  @group(1) @binding(0)
  var t: texture_2d<f32>;

  @group(1) @binding(1)
  var s: sampler;

  @group(1) @binding(2)
  var<uniform> lightColor: vec3<f32>;

  @group(1) @binding(3)
  var<uniform> lightPosition: vec3<f32>;

  @fragment
  fn main(@location(0) uv: vec2<f32>, @location(1) pos: vec3<f32>, @location(2) normal: vec3<f32>) -> @location(0) vec4<f32> {
    var baseColor: vec4<f32> = textureSample(t, s, uv);
    // Add a white background as the source png is transparent.
    baseColor.r = baseColor.r * baseColor.a + (1 - baseColor.a);
    baseColor.g = baseColor.g * baseColor.a + (1 - baseColor.a);
    baseColor.b = baseColor.b * baseColor.a + (1 - baseColor.a);
    baseColor.a = 1;

    var lightDirection: vec3<f32> = normalize(lightPosition - pos);
    var lightCos: f32 = max(dot(normalize(normal), lightDirection), 0);
    return vec4(baseColor.rgb * lightColor * lightCos, baseColor.a);
  }
`;

const vertices = new Float32Array([
  // x, y, z, u, v, nx, ny, nz
  // Front
  -1, 1, 1, 0, 0, 0, 0, 1,
  1, 1, 1, 1, 0, 0, 0, 1,
  1, -1, 1, 1, 1, 0, 0, 1,
  -1, -1, 1, 0, 1, 0, 0, 1,

  // Back
  1, 1, -1, 0, 0, 0, 0, -1,
  -1, 1, -1, 1, 0, 0, 0, -1,
  -1, -1, -1, 1, 1, 0, 0, -1,
  1, -1, -1, 0, 1, 0, 0, -1,

  // Right
  1, 1, 1, 0, 0, 1, 0, 0,
  1, 1, -1, 1, 0, 1, 0, 0,
  1, -1, -1, 1, 1, 1, 0, 0,
  1, -1, 1, 0, 1, 1, 0, 0,

  // Left
  -1, 1, -1, 0, 0, -1, 0, 0,
  -1, 1, 1, 1, 0, -1, 0, 0,
  -1, -1, 1, 1, 1, -1, 0, 0,
  -1, -1, -1, 0, 1, -1, 0, 0,

  // Top
  -1, 1, -1, 0, 0, 0, 1, 0,
  1, 1, -1, 1, 0, 0, 1, 0,
  1, 1, 1, 1, 1, 0, 1, 0,
  -1, 1, 1, 0, 1, 0, 1, 0,

  // Bottom
  -1, -1, 1, 0, 0, 0, -1, 0,
  1, -1, 1, 1, 0, 0, - 1, 0,
  1, -1, -1, 1, 1, 0, -1, 0,
  -1, -1, -1, 0, 1, 0, -1, 0,
]);

const vertexIndex = new Uint16Array([
  // Front
  0, 1, 2,
  2, 3, 0,

  // Back
  4, 5, 6,
  6, 7, 4,

  // Right
  8, 9, 10,
  10, 11, 8,

  // Left
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
  const lightPositionBuffer = createBufferWithData(device, GPUBufferUsage.UNIFORM, new Float32Array([1, 1, 1]));
  const lightColorBuffer = createBufferWithData(device, GPUBufferUsage.UNIFORM, new Float32Array([1, 1, 1]));

  const modelMatrixBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const normalMatrixBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const projectionMatrixBuffer = device.createBuffer({
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
      {
        shaderLocation: 2,
        offset: 20,
        format: "float32x3",
      },
    ],
    arrayStride: 32,
    stepMode: "vertex",
  };

  const vertexBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
    ],
  });

  const fragmentBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {},
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: {},
      },
    ],
  });

  const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [vertexBindGroupLayout, fragmentBindGroupLayout],
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

  const vertexBindGroup = device.createBindGroup({
    layout: vertexBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: projectionMatrixBuffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: modelMatrixBuffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: normalMatrixBuffer,
        },
      },
    ],
  });

  const fragmentBindGroup = device.createBindGroup({
    layout: fragmentBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: texture.createView(),
      },
      {
        binding: 1,
        resource: sampler,
      },
      {
        binding: 2,
        resource: {
          buffer: lightColorBuffer,
        },
      },
      {
        binding: 3,
        resource: {
          buffer: lightPositionBuffer,
        },
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
    const now = performance.now();
    const dt = now - lastTime;
    const angle = lastAngle + dt * speed;

    const modelMatrix = (new Matrix4())
      .rotateX(angle)
      .rotateY(angle)
      .scale(0.5, 0.5, 0.5);

    const normalMatrix = (new Matrix4()).setInverseOf(modelMatrix).transpose();

    const projectionMatrix = (new Matrix4())
      .setPerspective(30, view.width / view.height, 1, 100)
      .lookAt([3, 3, 7], [0, 0, 0], [0, 1, 0]);

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
    passEncoder.setBindGroup(0, vertexBindGroup);
    passEncoder.setBindGroup(1, fragmentBindGroup);
    passEncoder.setIndexBuffer(vertexIndexBuffer, "uint16");
    passEncoder.setVertexBuffer(0, vertexBuffer);

    passEncoder.drawIndexed(vertexIndex.length);
    passEncoder.end();

    device.queue.writeBuffer(projectionMatrixBuffer, 0, projectionMatrix.toWebGPUMatrix());
    device.queue.writeBuffer(modelMatrixBuffer, 0, modelMatrix.toWebGPUMatrix());
    device.queue.writeBuffer(normalMatrixBuffer, 0, normalMatrix.toWebGPUMatrix());
    device.queue.copyExternalImageToTexture({ source: textureImg }, { texture }, [textureImg.width, textureImg.height])
    device.queue.submit([cmdEncoder.finish()]);

    await requestNextAnimiationFrame();
    render(now, angle);
  };

  await render(performance.now(), 0);
}

export default main;
