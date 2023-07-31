import { loadObj, initWebGPU, createBufferWithData } from "./utils";
import { Matrix4 } from "./matrix";

const vertexSourceCode = `
  struct Result {
    @builtin(position) position: vec4<f32>,
    @location(0) pos: vec3<f32>,
    @location(1) normal: vec3<f32>,
  }

  @group(0) @binding(0)
  var<uniform> projectionMatrix: mat4x4<f32>;

  @group(0) @binding(1)
  var<uniform> modelMatrix: mat4x4<f32>;

  @group(0) @binding(2)
  var<uniform> normalMatrix: mat4x4<f32>;

  @vertex
  fn main (@location(0) position: vec3<f32>, @location(1) normal: vec3<f32>) -> Result {
    var pos: vec4<f32> = modelMatrix * vec4(position, 1.0);

    var res: Result;
    res.position = projectionMatrix * pos;
    res.pos = pos.xyz;
    res.normal = (normalMatrix * vec4(normal, 1.0)).xyz;
    return res;
  }
`;

const fragmentSourceCode = `
  @group(0) @binding(3)
  var<uniform> lightPosition: vec3<f32>;

  @fragment
  fn main(@location(0) pos: vec3<f32>, @location(1) normal: vec3<f32>) -> @location(0) vec4<f32> {
    var baseColor: vec4<f32> = vec4(1.0, 1.0, 1.0, 1.0);
    var lightColor: vec3<f32> = vec3(1.0, 1.0, 1.0);

    var lightDirection: vec3<f32> = normalize(lightPosition - pos);
    var lightCos: f32 = max(dot(normalize(normal), lightDirection), 0);
    return vec4(baseColor.rgb * lightColor * lightCos, baseColor.a);
  }
`;

const main = async (canvas: HTMLCanvasElement | null) => {
  const { vertices, vertexIndex } = await loadObj("./assets/cube.obj");
  const { device, ctx, presentFormat, view } = await initWebGPU(canvas);

  const vertexModule = device.createShaderModule({ code: vertexSourceCode });
  const fragmentModule = device.createShaderModule({ code: fragmentSourceCode });
  const vertexBuffer = createBufferWithData(device, GPUBufferUsage.VERTEX, vertices);
  const vertexIndexBuffer = createBufferWithData(device, GPUBufferUsage.INDEX, vertexIndex);
  const lightPositionBuffer = createBufferWithData(device, GPUBufferUsage.UNIFORM, new Float32Array([1.0, 1.0, 1.0]));
  const projectionMatrixBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const modelMatrixBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const normalMatrixBuffer = device.createBuffer({
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
        format: "float32x3",
      },
    ],
    arrayStride: 24,
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
        visibility: GPUShaderStage.VERTEX,
        buffer: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
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

  const projectionMatrix = (new Matrix4())
    .setPerspective(30, view.width / view.height, 1, 100)
    .lookAt([3, 3, 7], [0, 0, 0], [0, 1, 0]);
  const modelMatrix = (new Matrix4()).scale(0.5, 0.5, 0.5);
  const normalMatrix = (new Matrix4()).setInverseOf(modelMatrix).transpose();

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

  device.queue.writeBuffer(projectionMatrixBuffer, 0, projectionMatrix.toWebGPUMatrix());
  device.queue.writeBuffer(modelMatrixBuffer, 0, modelMatrix.toWebGPUMatrix());
  device.queue.writeBuffer(normalMatrixBuffer, 0, normalMatrix.toWebGPUMatrix());
  device.queue.submit([cmdEncoder.finish()]);
};

export default main;
