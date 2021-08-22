import * as global from "./global.js";

export const wgsl_shaders = {
  vertex: `
struct position_out {
[[location(0)]] v_dot_select : u32;
[[location(1)]] v_dot_rect_pos : vec2<f32>;
[[builtin(position)]] Position : vec4<f32>;
};

[[stage(vertex)]]
fn main([[location(0)]] a_dot_pos : vec2<f32>,
        [[location(1)]] a_dot_select : vec2<f32>,
        [[location(2)]] a_dot_rect_pos : vec2<f32>
) -> position_out {
  var output : position_out;
  output.Position = vec4<f32>(a_dot_rect_pos + a_dot_pos, 0.0, 1.0);
//  v_position = Position.xyz;
  if (a_dot_select.x == 0.0) {
    output.v_dot_select = 0u;
  } else {
    output.v_dot_select = 1u;
  }
  output.v_dot_rect_pos = a_dot_rect_pos;
  return output;
}
`,

  fragment: `
struct position_in {
[[location(0)]] v_dot_select : u32;
[[location(1)]] v_dot_rect_pos : vec2<f32>;
[[builtin(position)]] Position : vec4<f32>;
};

[[stage(fragment)]]
fn main(input: position_in) -> [[location(0)]] vec4<f32> {
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

struct dot_struct {
  xy : vec2<f32>;
  select : vec2<f32>;
};

[[block]] struct dots_array_struct {
  dots : [[stride(16)]] array<dot_struct, ${global.num_dots}>;
};

[[binding(0), group(0)]] var<uniform> uni : u_struct;
[[binding(1), group(0)]] var<storage, read_write> dots : dots_array_struct;


[[stage(compute), workgroup_size(64)]]
fn main([[builtin(global_invocation_id)]] GlobalInvocationID : vec3<u32>) {
  var index : u32 = GlobalInvocationID.x;
  if (index >= ${global.num_dots}u) { return; }

  var dots_index_xy : vec2<f32> = dots.dots[index].xy;

  var v : vec2<f32>;
  if (uni.mouse_state == ${global.mouse.UP}.0) {
    dots.dots[index].select = vec2<f32>(0.0, 0.0);
  }

  if (uni.mouse_state == ${global.mouse.DOWN}.0) {
    v = dots_index_xy - uni.mouse_xy;
    if (length(v) < ${global.dot_radius}) {
      dots.dots[index].select = vec2<f32>(1.0, 0.0);
    } else {
      dots.dots[index].select = vec2<f32>(0.0, 0.0);
    }
  }

  var xy_sum : vec2<f32> = vec2<f32>(0.0, 0.0);

  if (uni.mouse_state == ${global.mouse.MOVE_DOWN}.0 || uni.mouse_state == ${global.mouse.UP}.0) {

    if (dots.dots[index].select.x == 0.0) {
      for (var i : u32 = 0u; i < ${global.num_dots}u; i = i + 1u) {
        if (i != index) {
          v = (dots_index_xy - dots.dots[i].xy);
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

  dots.dots[index].xy = dots_index_xy;
  return;
}
`,
};
