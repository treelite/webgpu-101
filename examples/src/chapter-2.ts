/**
 * Draw a rotated triangle
 * Basic animation
 */

import { initWebGPU, requestNextAnimiationFrame, } from "./utils";
import { Matrix4 } from "./matrix";

// Vertex shader code
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

// Fragment shader code
const fragmentSourceCode = `
  @fragment
  fn main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
    return color;
  }
`;

// Vertex data
// coordinate + color
// x, y, z, r, g, b, a
const vertices = new Float32Array([
  // 1st vertex
  0, 0.5, 0, 1, 0, 0, 1,
  // 2nd vertex
  -0.5, -0.5, 0, 0, 1, 0, 1,
  // 3rd vertex
  0.5, -0.5, 0, 0, 0, 1, 1,
]);

const main = async (canvas: HTMLCanvasElement | null) => {
  if (!canvas) {
    throw new Error("cannot find canvas element");
  }

  const { device, ctx, presentFormat } = await initWebGPU(canvas);

  const vertexModule = device.createShaderModule({ code: vertexSourceCode });
  const fragmentModule = device.createShaderModule({ code: fragmentSourceCode });

  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
  vertexBuffer.unmap();

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
      }
    ],
    arrayStride: 28,
    stepMode: "vertex",
  };

  const modelViewMatrixBuffer = device.createBuffer({
    size: 4 * 16, // float32x(4x4)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: {},
    }],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: modelViewMatrixBuffer,
        },
      }
    ]
  });

  const pipelineDesc: GPURenderPipelineDescriptor = {
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
  };
  const renderPipeline = device.createRenderPipeline(pipelineDesc);

  const angleSpeed = 0.1;
  const render = async (lastAngle: number, lastRenderTime: number) => {
    const now = Date.now();
    const dt = now - lastRenderTime;
    const newAngle = lastAngle + angleSpeed * dt;
    // Module view transform matrix
    const modelViewMatrix = (new Matrix4()).translate(-0.5, 0.5, 0).scale(0.5, 0.5, 1).rotateZ(newAngle).toWebGPUMatrix();

    const cmdEncoder = device.createCommandEncoder();
    const passEncoder = cmdEncoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    });

    passEncoder.setPipeline(renderPipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, vertexBuffer);
    passEncoder.draw(3);
    passEncoder.end();

    // Write the new matrix into modelViewMatrixBuffer
    device.queue.writeBuffer(modelViewMatrixBuffer, 0, modelViewMatrix);
    device.queue.submit([cmdEncoder.finish()]);

    // Wait for next render
    await Promise.all([device.queue.onSubmittedWorkDone(), requestNextAnimiationFrame()]);
    render(newAngle, now);
  };

  await render(0, Date.now());
};

export default main;
