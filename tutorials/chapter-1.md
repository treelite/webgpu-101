---
title: "2D绘图"
---

GPU 最重要的工作就是绘图，在 WebGPU 中这部分主要由渲染管线（GPURenderPipeline）相关的API 来完成，这一节我们就将使用它来绘制一个二维彩色三角形。不过在开始实际探索前，我们先来简单了解下 GPU 是如何将一个图像呈现在显示设备上的。

## 绘图原理

从本质上讲，GPU 是通过精确控制显示设备上每一个像素的颜色来呈现一个图像的。从开发者的角度来看，直接操作所有的像素点来绘图是相当繁琐的，更别提分辨率的改变基本也就意味着代码的重写。

如果我们抛开像素观察图形本身，比如说一个三角形，不管是在哪种分辨率下，一个三角形总是由三个点连接而成，如果能确定三个顶点的坐标，我们也就确定的一个三角形。更进一步，我们可以通过点来确定线，线构成面，一步一步完成图像的绘制。这里也就引出了图形渲染中一个基本概念：顶点（vertex）。我们只需要确定图形所有顶点的坐标，就能通过连接它们来完成图形构建。

不过图形构建并不等同于图形渲染，虽然我们已经有了一个完整的图形，但我们仍然还不知道每个具体的像素点应该是什么颜色，因此我们需要一个特殊的处理来完成图形到像素点的映射，也就是光栅化。GPU 会将顶点所处的坐标系映射到输出平面上，以此来确定像素点与顶点的关系，进而确定每一个像素点的颜色。

总的来说，图形渲染中的两大关键步骤就是：
1. 通过顶点来完成图形的构建
2. 通过光栅化将图形经由像素呈现

仔细的你也许已经想到我们好像漏了什么：顶点的坐标确定了图形的形状，但是颜色信息又从何而来呢？实际上顶点信息中不光可以有坐标信息，还可以包含颜色信息。比如说三角形三个顶点都是红色，那么最终的三角形就是红色。那这样又会有一个有趣的问题，如果三个顶点的颜色各不相同会怎样呢？答案就是你会得到一个渐变的三角形！比如这样：

![渐变的三角形](./assets/chapter-1/colorful-triangle.png)

这是由于 GPU 在进行光栅化的过程中，为了确定非顶点点的数据而进行了插值计算。就如同点的坐标会平滑地从一个顶点过渡到另外一个顶点一样，颜色信息也会从一个顶点过渡到另外一个顶点，从而产生了颜色渐变的效果。

## 顶点数据

WebGPU 中的坐标系并不像页面坐标系那样将原点定义为页面左上角，WebGPU 的原点是在画布的中心点。x轴从左向右延伸，最小值为-1，最大值为1。相应的y轴从下往上，z轴从里向外，而取值都是-1到1。绘制二维图形的时候我们通常都将z轴设置为0，那么本次的三角形顶点的坐标如下：
```typescript
const vertices = new Float32Array([
  // 顶部
  0, 0.5, 0,
  // 左下角
  -0.5, -0.5, 0,
  // 右下角
  0.5, -0.5, 0,
]);
```

需要特别注意的是由于 WebGPU 中顶点数据是 `flat32` 类型，因此我们在定义顶点时得使用类型数组`Float32Array`。另外如果再加上顶点颜色信息的话，顶点数据就会长这样：
```typescript
const vertices = new Float32Array([
  // 顶部，红色
  0, 0.5, 0, 1, 0, 0, 1,
  // 左下角，绿色
  -0.5, -0.5, 0, 0, 1, 0, 1,
  // 右下角，蓝色
  0.5, -0.5, 0, 0, 0, 1, 1,
]);
```

颜色使用 `RGBA` 形式定义，同样是用 `flat32` 类型，取值范围是0 ~ 1。这里我们设置顶部为红色(1, 0, 0, 1), 左下角为绿色(0, 1, 0, 1)，右下角为蓝色(0, 0, 1, 1)。

虽然我们已经有了完整的顶点数据，但是它还不能被直接用于渲染，最主要的原因是 GPU 无法直接操作内存中的数据。GPU 是高度并行的计算单元，内存的读写速度并不能达到 GPU 的需求，反而会极大地影响 GPU 的运算速度，因此 GPU 有专用的高速数据缓存区，也就是显存。同 GPU 无法直接操作内存一样，CPU 也无法直接操作显存，因此我们需要将顶点数据从内存拷贝到显存中，以供 GPU 使用。在 WebGPU 中，这部分操作通过 `GPUBuffer`  对象来完成的：
```typescript
const vertexBuffer = device.createBuffer({
  size: vertices.byteLength,
  usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  mappedAtCreation: true,
});
```
我们通过 `createBuffer` 方法来创建一个 `GPUBuffer` 对象。其中的 `size` 与 `usage` 是必选参数，分别用于指定其大小（以字节为单位）与用途。完整的用途列表可以在[这里找到](https://www.w3.org/TR/webgpu/#buffer-usage)，目前我们使用 `GPUBufferUsage.VERTEX` 来表明此 Buffer 用于存储顶点信息并且是数据拷贝操作的目的地 `GPUBufferUsage.COPY_DST`。可选参数 `mappedAtCreation` 用于表明是否在创建该 Buffer 后直接映射到内存中。`GPUBuffer` 代表显存中的缓冲区，在进行与内存的数据交换时需要先将其映射到内存上，然后再通过内存中数据的拷贝来完成数据的交换。如果在创建时不进行映射，后续可以通过 `GPUBuffer` 对象的 `mapAsync` 方法来完成映射。另外还需要注意的是完成数据操作后需要显式调用 `unmap` 方法来取消映射，只有在进行此操作后显存中的数据才能再次被 GPU 使用。
```typescript
new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
vertexBuffer.unmap();
```
`getMappedRange` 方法返回映射后的 `ArrayBuffer` 对象。由于我们的顶点是使用 `Float32Array` 定义的，所以这里先将原始的 `ArrayBuffer` 转化为 `Float32Array`，然后再调用其 `set` 方法来进行数据拷贝，最后使用 `unmap` 方法来取消映射。之后我们就可以使用这个已经包含所有顶点数据的 `vertexBuffer` 对象来进行渲染了。

## 顶点着色器与片元着色器

之前提到过，图形渲染中有两大关键步骤：通过顶点来构建图形以及通过光栅化来显示图形。为了更好的控制和自定义这两个步骤，GPU 提供了一种可编程的方式来进行操作，也就是着色器(shader)，一种使用特定的着色器语言(shader language)进行编写、并最终由 GPU 执行的程序。着色器的主要工作就是告诉 GPU 该如何处理数据、执行渲染，按照执行阶段的不同可以简单分为：
* 顶点着色器：处理顶点数据，确定顶点的坐标与颜色等数据，主要负责构建图形
* 片元着色器：运行在光栅化过程中，用于确定每一个片元(fragment)的颜色等信息。片元就是用于生成最终像素的信息，包括但不仅限于颜色，同时一个像素点可能需要多个片元配合来生成。

通常情况下，顶点着色器的输入是顶点数据，输出会成为片元着色器的输入，而片元着色器的输出就是最终的片元信息（颜色等）：
```mermaid
flowchart LR
    input[(顶点数据)]-->vShader(顶点着色器)-- 顶点着色器输出 -->fShader(片元着色器)-->output[(片元信息)]
```

WebGPU 使用的着色器语言是 [WGSL](https://www.w3.org/TR/WGSL)，类似于带装饰器的 `Rust` 语言，比如说我们这次绘制三角形需要用到顶点着色器：
```rust
// 定义一个包含输出数据的结构
struct Result {
  // 将 "position" 属性绑定到内建的 position 值，用于指定顶点位置
  @builtin(position) position: vec4<f32>,
  // 将 "color" 属性做为顶点着色器第一输出位置的数据
  @location(0) color: vec4<f32>,
}

// 声明此函数是顶点着色器的入口函数
@vertex
/**
 * 定义了两个输入参数
 * position {vec3<f32>} float32 的三维向量(x, y, z)
 * color {vec4<f32>} float32 的四维向量(r, g, b, a)
 *
 * 同时返回参数是之前定义的 Result 结构
 */
fn main (@location(0) position: vec3<f32>, @location(1) color: vec4<f32>) -> Result {
  var res: Result;
  // 将输入参数赋值给 position 属性，也就是在设置内建的 position 值，即顶点坐标
  // 输入参数是三维向量，而内建的 position 值是四维向量，所以这里进行了一下简单的数据转化
  // 使用 “1.0” 来填充缺失的第四维数值
  res.position = vec4(position, 1.0);
  // 直接输出输入的颜色信息
  res.color = color;
  return res;
}
```

顶点着色器会将每一个顶点做为一次输入，执行后确定该顶点的最终坐标等信息。我们这个示例很简单，直接将输入的顶点信息输出。关键点在于 `@builtin(position)` ，它指定了如何将坐标信息绑定到内建的 "position" 属性，也就是顶点的最终坐标。后续我们会在顶点着色器中看到更多、更复杂的顶点操作，比如将顶点进行旋转、移动等。

那我们接着来看这次会使用到的片元着色器：
```rust
// 声明此函数是片元着色器的入口函数
@fragment
/**
 * 定义了一个绑定到第一输入位置的参数
 * color {vec4<f32>} float32 的四维向量(r, g, b, a)
 *
 * 返回一个四维向量并将其做为片原作色器的第一输出位置的数据
 */
fn main(@location(0) color: vec4<f32>) -> @location(0) vec4<f32> {
  return color;
}
```

它也很简单，没有任何额外的操作，同样是直接将输入的颜色做为输出。唯一需要关注的地方是顶点着色器的输出是如何关联被到片元着色器的输入上。注意代码中的 `@location` 装饰器，它用于指定输入数据的获取位置或者输出数据的存放位置。在顶点着色器中，我们将 `@location(0)` 设置到了结构体 `Result` 中的 `color` 属性上，也就是说顶点的颜色 `color` 会被存在0号位置上。而在片元着色器中，我们的输入参数 `color` 也使用了 `@location(0)`，也就这个值会从0号位置上获取，这样也就实现了从顶点着色器到片元着色器的数据传输。最后片元着色器再将处理后的颜色存在0号位置以供后续渲染操作使用。

### 编译着色器

由于着色器程序是运行在 GPU 上，我们的浏览器（或者严格意义上说 CPU ）是无法直接编译它们的。我们需要在运行它们之前提交给 GPU 进行编译，这就需要用到 `createShaderModule` 方法来创建对应的着色器模块并进行编译工作：
```typescript
const vertexModule = device.createShaderModule({
    code: vertexSourceCode,
});
```
返回值是一个 `GPUShaderModule` 对象，它包含对内部着色器程序的引用，后续我们会将它绑定到对应的渲染管道中来调用相应的着色器。这个对象还有一个 `compilationInfo` 方法可以用来获取着色器的编译信息，包括错误、警告及其提示信息：
```typescript
const { messages } = await vertexModule.compilationInfo();
for (const msg of messages) {
  switch (msg.type) {
    case "error":
      ...
      break
    case "warning":
      ...
      break
    case "info":
      ...
      break
  }
}
```

## 渲染管线

至此我们已经有了需要渲染的顶点数据与包含渲染逻辑的着色器，下一步就是让 GPU 按照我们的需求来进行渲染，也就是设置具体的渲染管线（GPURenderPipeline）。渲染管线会将所有渲染需要的数据绑定在一起，并通过设置渲染相关的参数来告诉 GPU 具体该如何进行渲染。首先我们来看看如何将显存中的数据绑定到我们的着色器中。

在顶点着色器中，我们通过 `@location` 指定了输入参数 `position` 与 `color` 的值分别来源于位置0与位置1，但我们还没有说明具体什么样的数据能被存在这些位置上，而 `GPUVertexBufferLayout` 对象就是用来表示这种对应关系的：
```typescript
const bufferLayout: GPUVertexBufferLayout = {
  attributes: [
    // 顶点坐标
    {
      shaderLocation: 0,
      offset: 0,
      format: "float32x3",
    },
    // 顶点颜色
    {
      shaderLocation: 1,
      offset: 12, // 4 * 3
      format: "float32x4",
    },
  ],
  // 步进长度，也就是每个顶点信息的长度
  // 4 * 3 + 4 * 4
  arrayStride: 28,
  stepMode: "vertex",
};
```
`attributes` 属性定义了这个缓冲区布局会提供两种数据：顶点坐标与顶点颜色，分别对应着色器中的位置0与位置1。`offset` 与 `format` 属性指定数据的起始位置与格式（也就是长度）。根据我们之前顶点数据的定义，前3个数为顶点坐标，后4个数为顶点颜色。因此对于坐标而言，它是起始位置为`0`，跨越3个 `float32` 的数据段，而颜色就是起始位置为`12`字节，跨越4个`float32`的数据段。进而一个完整顶点数据的大小为 28（4 * 3 + 4 * 4）字节，也就是 `arrayStride` 的值。另外 `stepMode` 的取值除了 `"vertex"` 还有 `"instance"`，用于指定的具体的步进模式，它们具体的区别我们后续会涉及到，目前而言 `"vertex"` 就是我们所期望的模式。

在确定了缓冲区布局方式后，我们就可以开始通过 `device.createRenderPipeline` 方法创建具体的渲染管线了。此方法只有一个参数 `GPURenderPipelineDescriptor`，也就是渲染管线的各种配置参数：
```typescript
const pipelineDesc: GPURenderPipelineDescriptor = {
  // 使用自动布局
  // 后续我们需要绑定更复杂的数据到着色器中时就需要手动设置布局
  layout: "auto",
  // 顶点着色器相关设置
  vertex: {
    // 指定着色器程序
    module: vertexModule,
    // 指定着色器入口函数
    entryPoint: "main",
    // 指定着色器使用的缓冲区布局方式
    buffers: [bufferLayout],
  },
  // 片元着色器相关设置
  fragment: {
    // 指定着色器程序
    module: fragmentModule,
    // 指定着色器入口函数
    entryPoint: "main",
    // 指定渲染的输出参数
    targets: [{ format: presentFormat }],
  },
  // 指定各顶点应该如何被渲染
  primitive: {
    // 按照三角形进行渲染
    topology: "triangle-list",
  },
};

const renderPipeline = device.createRenderPipeline(pipelineDesc);
```
渲染管线将着色器、数据缓存区布局、渲染参数结合在了一起，其中的 `presentFormat` 是当前设备支持的颜色格式，之前在设置 `CanvasContext` 中使用过。之后我们只需要将这个渲染管线应用到渲染流程中就成了：
```typescript
passEncoder.setPipeline(renderPipeline);
passEncoder.setVertexBuffer(0, vertexBuffer);
passEncoder.draw(3);
```
`passEncoder` 是上一章使用过的渲染命令编译器，我们使用 `setPipeline` 方法来使用具体的渲染管线，并通过 `setVertexBuffer` 将实际的顶点数据与渲染管线相绑定。渲染管线的定义只包含了顶点数据的结构（`GPUVertexBufferLayout`）而非具体的数据地址，这样做的好处是后续可以使用相同的渲染管线来处理相同结构的多个顶点数据。最后我们调用 `draw` 方法来渲染3个顶点，如果一切顺利我们应该就可以得到文章开头所提到的那个渐变的三角形了：

![最终渲染结果](./assets/chapter-1/result.png)

完整代码请参考[这里](https://github.com/treelite/webgpu-101/blob/master/examples/src/chapter-1.ts)。

## 总结

通常情况下，渲染主要依赖于数据（比如顶点数据）与着色器。渲染管线就是将所有这些数据、设置结合到一起来描述一次渲染。
