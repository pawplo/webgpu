import * as global from "./global.js";
import * as wgsl from "./wgsl.js";

let render_max_interval_ms = 10;


async function init()
{
  const canvas = document.querySelector('canvas');

  const canvas_size = (window.innerWidth > window.innerHeight) ?
      window.innerHeight : window.innerWidth;
  canvas.width = canvas_size;
  canvas.height = canvas_size;
//  canvas.width = window.innerWidth;
//  canvas.height = window.innerHeight;

  if (!navigator.gpu) { global.webgpu_error("!navigator.gpu"); return; }

  var adapter;
  try { adapter = await navigator.gpu.requestAdapter(); }
  catch (e) { global.webgpu_error(e); return; }
  if (!adapter) { global.webgpu_error("navigator.gpu.requestAdapter()"); return; }

  var device;
  try { device = await adapter.requestDevice(); }
  catch (e) { global.webgpu_error(e); return; }

  const context = canvas.getContext('webgpu');
  if (!context) { global.webgpu_error("canvas.getContext('webgpu')"); return; }

  context.configure({
    device,
    format: 'bgra8unorm',
  });

  const render_pipe_line = device.createRenderPipeline({
    vertex: {
      module:
            device.createShaderModule({
            code: wgsl.wgsl_shaders.vertex,
          }),
      entryPoint: 'main',
      buffers: [
        {
          arrayStride: 4 * 4,
          stepMode: 'instance',
          attributes: [
            {
              shaderLocation: 0, // [x, y]
              offset: 0,
              format: 'float32x2',
            },
            {
              shaderLocation: 1, // [selected, ]
              offset: 2 * 4,
              format: 'float32x2',
            },
          ],
        },
        {
          arrayStride: 2 * 4,
          stepMode: 'vertex',
          attributes: [
            {
              shaderLocation: 2, // [dot rect, ]
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
            code: wgsl.wgsl_shaders.fragment,
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

  const compute_pipe_line = device.createComputePipeline({
    compute: {
      module:
          device.createShaderModule({
            code: wgsl.wgsl_shaders.compute,
          }),
      entryPoint: 'main',
    },
  });

  const render_pass_descriptor = {
    colorAttachments: [
      {
        view: undefined,
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

  const dot_rect_array = new Float32Array([  global.dot_radius,  global.dot_radius, -global.dot_radius,  global.dot_radius,  global.dot_radius, -global.dot_radius,
                                              -global.dot_radius,  global.dot_radius,  global.dot_radius, -global.dot_radius, -global.dot_radius, -global.dot_radius
                            , ])
  const dot_rect_buffer = create_buffer(dot_rect_array, GPUBufferUsage.VERTEX);

  const uniform_array = new Float32Array([
    0.0, //MOUSE_X_LAST
    0.0, //MOUSE_Y_LAST
    0.0, //MOUSE_X
    0.0, //MOUSE_Y
    0.0, //EVENT
  ]);
  const uniform_buffer = create_buffer(uniform_array, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

  const dots_array = new Float32Array(global.num_dots * 4);
  for (let i = 0; i < global.num_dots; ++i) {
    dots_array[i * 4    ] = 2 * (Math.random() - 0.5);
    dots_array[i * 4 + 1] = 2 * (Math.random() - 0.5);
    dots_array[i * 4 + 2] = 0.0;
    dots_array[i * 4 + 3] = 0.0;
  }
    const dots_buffer = create_buffer(dots_array,
              GPUBufferUsage.VERTEX | GPUBufferUsage.STORAGE);

    const dots_bind_group = device.createBindGroup({
      layout: compute_pipe_line.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: uniform_buffer,
            offset: 0,
            size: uniform_buffer.byteLength,
          },
        },
        {
          binding: 1,
          resource: {
            buffer: dots_buffer,
            offset: 0,
            size: dots_array.byteLength,
          },
        },
      ],
    });

  let now = Date.now();
  let now_copy = now;

  var mouse_move = 0;
  function render()
  {
    device.queue.writeBuffer( uniform_buffer, 0,
      uniform_array.buffer, uniform_array.byteOffset, uniform_array.byteLength,
    );

    const command_encoder = device.createCommandEncoder();

    render_pass_descriptor.colorAttachments[0].view = context.getCurrentTexture().createView();

    const compute_pass = command_encoder.beginComputePass();
    compute_pass.setPipeline(compute_pipe_line);
    compute_pass.setBindGroup(0, dots_bind_group);
    compute_pass.dispatch(global.num_dots);
    compute_pass.endPass();

    const render_pass = command_encoder.beginRenderPass(render_pass_descriptor);
    render_pass.setPipeline(render_pipe_line);
    render_pass.setVertexBuffer(0, dots_buffer);
    render_pass.setVertexBuffer(1, dot_rect_buffer);
    render_pass.draw(6, global.num_dots, 0, 0);
    render_pass.endPass();

    device.queue.submit([command_encoder.finish()]);

  }

  function mousemove_event(e)
  {
    if (uniform_array[global.uniform.EVENT] == global.mouse.DOWN || uniform_array[global.uniform.EVENT] == global.mouse.MOVE_DOWN ) {
//      let x=e.layerX; let y=e.layerY;
//      console.log("left move x="+x+" y="+y);

      now = Date.now();
      if ((now - now_copy) > render_max_interval_ms) {
        now_copy = now;
        let x=e.layerX; let y=e.layerY;
//      console.log("left move x="+x+" y="+y);
        uniform_array[global.uniform.EVENT] = global.mouse.MOVE_DOWN;
        uniform_array[global.uniform.MOUSE_X_LAST] = uniform_array[global.uniform.MOUSE_X];
        uniform_array[global.uniform.MOUSE_Y_LAST] = uniform_array[global.uniform.MOUSE_Y];
        uniform_array[global.uniform.MOUSE_X] = (x/(canvas.width)*2.0)-1.0;
        uniform_array[global.uniform.MOUSE_Y] = -(y/(canvas.height)*2.0)+1.0;
        render();
      } //else { console.log("(now - now_copy)="+(now - now_copy)); }
    }
  }

  function mousedown_event(e)
  {
//    if (e.button == 0) {
      let x=e.layerX; let y=e.layerY;
//      console.log("down x="+x+" y="+y);
      uniform_array[global.uniform.EVENT] = global.mouse.DOWN;
      uniform_array[global.uniform.MOUSE_X] = (x/(canvas.width)*2.0)-1.0;
      uniform_array[global.uniform.MOUSE_Y] = -(y/(canvas.height)*2.0)+1.0;
      render();
//    }
  }

  function mouseup_event(e)
  {
//    if (e.button == 0) {
      let x=e.layerX; let y=e.layerY;
//      console.log("up x="+x+" y="+y);
      uniform_array[global.uniform.EVENT] = global.mouse.UP;
      uniform_array[global.uniform.MOUSE_X_LAST] = uniform_array[global.uniform.MOUSE_X];
      uniform_array[global.uniform.MOUSE_Y_LAST] = uniform_array[global.uniform.MOUSE_Y];
      uniform_array[global.uniform.MOUSE_X] = (x/(canvas.width)*2.0)-1.0;
      uniform_array[global.uniform.MOUSE_Y] = -(y/(canvas.height)*2.0)+1.0;
      render();
//    }
  }

  canvas.addEventListener('mousemove', mousemove_event, false);
  canvas.addEventListener('mousedown', mousedown_event, false);
  canvas.addEventListener('mouseup', mouseup_event, false);

  requestAnimationFrame(render);
}

init();
