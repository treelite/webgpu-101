/**
 * Draw a colorful triangle
 * Basic 2D rendering
 */

import { initWebGPU } from "./utils";

// Vertex shader code
const vertexSourceCode = `
  struct Result {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
  }

  @vertex
  fn main (@location(0) position: vec3<f32>, @location(1) color: vec4<f32>) -> Result {
    var res: Result;
    res.position = vec4(position, 1.0);
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

  const vertexModule = device.createShaderModule({
    code: vertexSourceCode,
  });

  const fragmentModule = device.createShaderModule({
    code: fragmentSourceCode,
  });

  const vertexBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    // In order to initialise this buffer, it needs to map
    // https://gpuweb.github.io/gpuweb/explainer/#memory-visibility
    mappedAtCreation: true,
  });
  // Transfer vertex data
  new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
  vertexBuffer.unmap();

  // Define the buffer layout
  const bufferLayout: GPUVertexBufferLayout = {
    // Two attributes in the vertex buffer
    attributes: [
      // coordinate
      {
        shaderLocation: 0,
        offset: 0,
        format: "float32x3",
      },
      // color
      {
        shaderLocation: 1,
        offset: 12,
        format: "float32x4",
      }
    ],
    // Size for one vertex data
    arrayStride: 28,
    stepMode: "vertex",
  };

  // Define render pipeline
  const pipelineDesc: GPURenderPipelineDescriptor = {
    // Use auto layout as we don't have any extra binding group yet
    layout: "auto",
    // Specify vertex shader and the input buffer
    vertex: {
      module: vertexModule,
      entryPoint: "main",
      buffers: [bufferLayout],
    },
    // Specify fragment shader
    fragment: {
      module: fragmentModule,
      entryPoint: "main",
      targets: [{ format: presentFormat }],
    },
    // Describe how to draw these vertices
    primitive: {
      topology: "triangle-list",
    },
  };

  const renderPipeline = device.createRenderPipeline(pipelineDesc);

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
  passEncoder.setVertexBuffer(0, vertexBuffer);
  // Draw 3 vertices
  passEncoder.draw(3);
  passEncoder.end();

  device.queue.submit([cmdEncoder.finish()]);
};

export default main;
