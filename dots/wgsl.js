import * as global from "./global.js";

export const wgsl_shaders = {
  vertex_fragment: `
struct in_out_struct {
[[builtin(position)]] Position : vec4<f32>;
[[location(0)]] v_dot_rect_pos : vec2<f32>;
[[location(1)]] v_dot_select : u32;
};

[[stage(vertex)]]
fn vertex_main([[location(0)]] a_dot_pos : vec2<f32>,
        [[location(1)]] a_dot_rect_pos : vec2<f32>,
        [[location(2)]] a_dot_select : u32) -> in_out_struct {

  var output : in_out_struct;
  output.Position = vec4<f32>(a_dot_rect_pos + a_dot_pos, 0.0, 1.0);
  output.v_dot_select = a_dot_select;
  output.v_dot_rect_pos = a_dot_rect_pos;

  return output;
}

[[stage(fragment)]]
fn fragment_main(input: in_out_struct) -> [[location(0)]] vec4<f32> {

  if (length(input.v_dot_rect_pos) > ${global.dot_radius}) {
    discard;
  }

  if (input.v_dot_select == 0u) {
    return vec4<f32>(1.0, 0.0, 0.0, 1.0);
  }

  return vec4<f32>(0.0, 1.0, 0.0, 1.0);
}
`,

  compute: `
[[block]] struct u_struct {
  mouse_xy_last : vec2<f32>;
  mouse_xy :      vec2<f32>;
  mouse_state :  f32;
};

[[block]] struct dots_array_struct {
  dots : [[stride(8)]] array<vec2<f32>, ${global.num_dots}>;
};

[[block]] struct dots_select_struct {
  dots : [[stride(4)]] array<u32, ${global.num_dots}>;
};

[[binding(0), group(0)]] var<uniform> uni : u_struct;
[[binding(1), group(0)]] var<storage, read> dots : dots_array_struct;
[[binding(2), group(0)]] var<storage, read_write> dots_b : dots_array_struct;
[[binding(3), group(0)]] var<storage, read_write> dots_select : dots_select_struct;


[[stage(compute), workgroup_size(64)]]
fn main([[builtin(global_invocation_id)]] GlobalInvocationID : vec3<u32>) {
  var index : u32 = GlobalInvocationID.x;
  if (index >= ${global.num_dots}u) { return; }

  var dots_index_xy : vec2<f32> = dots.dots[index];

  var v : vec2<f32>;
  if (uni.mouse_state == ${global.mouse.UP}.0) {
    dots_select.dots[index] = 0u;
  }

  if (uni.mouse_state == ${global.mouse.DOWN}.0) {
    v = dots_index_xy - uni.mouse_xy;
    if (length(v) < ${global.dot_radius}) {
      dots_select.dots[index] = 1u;
    } else {
      dots_select.dots[index] = 0u;
    }
  }

  var xy_sum : vec2<f32> = vec2<f32>(0.0, 0.0);

  if (uni.mouse_state == ${global.mouse.MOVE_DOWN}.0 || uni.mouse_state == ${global.mouse.UP}.0) {

    if (dots_select.dots[index] == 0u) {
      for (var i : u32 = 0u; i < ${global.num_dots}u; i = i + 1u) {
        if (i != index) {
          v = (dots_index_xy - dots.dots[i]);
          if ((length(v) < (${global.dot_diameter}))) {
            v = (normalize(v) *  ${global.dot_diameter} - v);
            if (length(uni.mouse_xy - dots_index_xy - v) < length(uni.mouse_xy - dots_index_xy + v)) {
              continue;
            }
            xy_sum = xy_sum + v;
          }
        }
      }

//      if (length(uni.mouse_xy - dots_index_xy - xy_sum) > length(uni.mouse_xy - dots_index_xy + xy_sum)) {
        dots_index_xy = dots_index_xy + xy_sum;
//    }

    } else {
      dots_index_xy = dots_index_xy + (uni.mouse_xy - uni.mouse_xy_last);
    }

  }

  // if (dots_index_xy.x < -1.0) { dots_index_xy.x =  1.0; }
  // if (dots_index_xy.x >  1.0) { dots_index_xy.x = -1.0; }
  // if (dots_index_xy.y < -1.0) { dots_index_xy.y =  1.0; }
  // if (dots_index_xy.y >  1.0) { dots_index_xy.y = -1.0; }

  dots_b.dots[index] = dots_index_xy;
  return;
}
`,
};
