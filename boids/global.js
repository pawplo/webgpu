// Based off of https://github.com/austinEng/webgpu-samples
export const numParticles = 100;

export function webgpu_error(str)
{
  document.getElementById("webgpu_error").innerText = "webgpu error: [ "+str+" ]";
}
