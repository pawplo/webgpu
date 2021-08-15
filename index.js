// Based off of https://github.com/austinEng/webgpu-samples/blob/master/compute_boids.html
import * as global from "./global.js";
import * as wgsl from "./wgsl.js";

function webgpu_error(str)
{
  document.getElementById("webgpu_error").innerText = "webgpu error: [ "+str+" ]";
}

async function init() {
  console.log("init()");
  const canvas = document.querySelector('canvas');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  if (!navigator.gpu) { webgpu_error("!navigator.gpu"); return; }

  var adapter;
  try { adapter = await navigator.gpu.requestAdapter({}); }
  catch (e) { webgpu_error(e); return; }
  if (!adapter) { webgpu_error("navigator.gpu.requestAdapter()"); return; }

  var device;
  try { device = await adapter.requestDevice(); }
  catch (e) { webgpu_error(e); return; }

  const context = canvas.getContext('webgpu');
  if (!context) { webgpu_error("canvas.getContext('webgpu')"); return; }

  const presentationFormat = context.getPreferredFormat(adapter);

  context.configure({
    device,
    format: presentationFormat, //'bgra8unorm',
  });

  const renderPipeline = device.createRenderPipeline({
    vertex: {
      module:
            device.createShaderModule({
            code: wgsl.wgslShaders.vertex,
          }),
      entryPoint: 'main',
      buffers: [
        {
          // instanced particles buffer
          arrayStride: 4 * 4,
          stepMode: 'instance',
          attributes: [
            {
              // instance position
              shaderLocation: 0,
              offset: 0,
              format: 'float32x2',
            },
            {
              // instance velocity
              shaderLocation: 1,
              offset: 2 * 4,
              format: 'float32x2',
            },
          ],
        },
        {
          // vertex buffer
          arrayStride: 2 * 4,
          stepMode: 'vertex',
          attributes: [
            {
              // vertex positions
              shaderLocation: 2,
              offset: 0,
              format: 'float32x2',
            },
          ],
        },
      ],
    },
    fragment: {
      module:
          device.createShaderModule({
            code: wgsl.wgslShaders.fragment,
          }),
      entryPoint: 'main',
      targets: [
        {
          format: 'bgra8unorm',
        },
      ],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  const computePipeline = device.createComputePipeline({
    compute: {
      module:
          device.createShaderModule({
            code: wgsl.wgslShaders.compute,
          }),
      entryPoint: 'main',
    },
  });

  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: undefined, // Assigned later
        loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    ],
  };

  function create_buffer(bufferData, usage)
  {
    const buffer = device.createBuffer({
      size: bufferData.byteLength,
      usage: usage,
      mappedAtCreation: true,
    });
    new Float32Array(buffer.getMappedRange()).set(bufferData);
    buffer.unmap();
    return buffer;
  }

  const vertexBufferData = new Float32Array([ -0.01, -0.02, 0.01, -0.02, 0.0, 0.02 ])
  const verticesBuffer = create_buffer(vertexBufferData, GPUBufferUsage.VERTEX);

  const simParamData = new Float32Array([
    0.04, // deltaT;
    0.1, // rule1Distance;
    0.025, // rule2Distance;
    0.025, // rule3Distance;
    0.02, // rule1Scale;
    0.05, // rule2Scale;
    0.005, // rule3Scale;
  ]);
  const simParamBuffer = create_buffer(simParamData, GPUBufferUsage.UNIFORM);

  const initialParticleData = new Float32Array(global.numParticles * 4);
  for (let i = 0; i < global.numParticles; ++i) {
    initialParticleData[4 * i + 0] = 2 * (Math.random() - 0.5);
    initialParticleData[4 * i + 1] = 2 * (Math.random() - 0.5);
    initialParticleData[4 * i + 2] = 2 * (Math.random() - 0.5) * 0.1;
    initialParticleData[4 * i + 3] = 2 * (Math.random() - 0.5) * 0.1;
  }
  const particleBuffers = new Array(2);
  const particleBindGroups = new Array(2);
  for (let i = 0; i < 2; ++i)
    particleBuffers[i] = create_buffer(initialParticleData,
              GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE);

  for (let i = 0; i < 2; ++i) {
    particleBindGroups[i] = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: simParamBuffer,
            offset: 0,
            size: simParamData.byteLength,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: particleBuffers[i],
            offset: 0,
            size: initialParticleData.byteLength,
          },
        },
        {
          binding: 2,
          resource: {
            buffer: particleBuffers[(i + 1) % 2],
            offset: 0,
            size: initialParticleData.byteLength,
          },
        },
      ],
    });
  }

  let t = 0;
  let now = Date.now();

  function frame() {
    renderPassDescriptor.colorAttachments[0].view = context
      .getCurrentTexture()
      .createView();

    const commandEncoder = device.createCommandEncoder();

    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(computePipeline);
    passEncoder.setBindGroup(0, particleBindGroups[t % 2]);
    passEncoder.dispatch(global.numParticles);
    passEncoder.endPass();

    const passEncoder2 = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder2.setPipeline(renderPipeline);
    passEncoder2.setVertexBuffer(0, particleBuffers[(t + 1) % 2]);
    passEncoder2.setVertexBuffer(1, verticesBuffer);
    passEncoder2.draw(3, global.numParticles, 0, 0);
    passEncoder2.endPass();

    device.queue.submit([commandEncoder.finish()]);

    if ((t % 200) == 0) {
      let now_copy = now;
      now = Date.now();
      console.log((now - now_copy)/200.0+" fps");
    }
    ++t;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init();