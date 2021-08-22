export const mouse = {
  MOVE_UP:   0.0,
  MOVE_DOWN: 1.0,
  UP:        2.0,
  DOWN:      3.0,
}

export const uniform = {
    MOUSE_X_LAST: 0,
    MOUSE_Y_LAST: 1,
    MOUSE_X: 2,
    MOUSE_Y: 3,
    EVENT: 4,
}

export function webgpu_error(str)
{
  document.getElementById("webgpu_error").innerText = "webgpu error: [ "+str+" ]";
  document.getElementById("webgpu_error").style.display = 'inline';
}

export const num_dots = 1000;
export const dot_radius = 0.05;
export const dot_diameter = dot_radius * 2.0;
