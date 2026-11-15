// 离屏色版光栅化 shader：R=覆盖率 G=挖空掩膜 B=陷印 A=字孔
export const RASTER_VS = `#version 300 es
in vec2 a_pos;
uniform vec2 u_pxPerMm;
uniform vec2 u_halfSize;
void main() {
  vec2 px = a_pos * u_pxPerMm + u_halfSize;
  vec2 clip = px / u_halfSize - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`

export const RASTER_FS = `#version 300 es
precision highp float;
uniform vec4 u_rgba;
out vec4 outColor;
void main() { outColor = u_rgba; }`

// 屏幕合成：按墨序逐版叠印/挖空
export const SCREEN_VS = `#version 300 es
in vec2 a_pos;   // 裁剪空间或像素空间（由 u_ortho 决定）
in vec2 a_uv;
uniform mat4 u_ortho;
out vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = u_ortho * vec4(a_pos, 0.0, 1.0);
}`

export const SCREEN_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 frag;

uniform sampler2D u_plates[12];
uniform int u_count;
uniform vec3 u_ink[12];
uniform float u_opacity[12];
uniform vec2 u_offset[12]; // 套准偏移，单位像素
uniform vec2 u_texSize;
uniform vec3 u_paper;
uniform float u_paperOpacity;
uniform int u_solo;          // 单版查看的索引，-1 为合成
uniform int u_halftone;
uniform float u_angle[12];
uniform int u_leakLocate;
uniform vec2 u_leakPx;       // 漏白检测膨胀半径像素

// 旋转网点圆网屏：返回 0/1 着墨
float halftoneDot(vec2 uv, float angle, float coverage) {
  float rad = radians(angle);
  mat2 rot = mat2(cos(rad), -sin(rad), sin(rad), cos(rad));
  vec2 p = rot * (uv * u_texSize);
  const float freq = 9.0;
  vec2 cell = mod(p, freq) - freq * 0.5;
  float r = length(cell);
  float dotR = sqrt(max(coverage, 0.0)) * freq * 0.5;
  return r < dotR ? 1.0 : 0.0;
}

vec2 shiftedUv(int i) {
  return clamp(v_uv + u_offset[i] / u_texSize, vec2(0.0), vec2(1.0));
}

void main() {
  if (u_solo >= 0) {
    vec4 t = texture(u_plates[u_solo], shiftedUv(u_solo));
    float cov = t.r;
    if (u_halftone == 1)
      cov *= halftoneDot(v_uv, u_angle[u_solo], cov);
    vec3 col = mix(u_paper, u_ink[u_solo], cov * u_opacity[u_solo]);
    frag = vec4(col, 1.0);
    return;
  }

  vec3 acc = u_paper;
  float maxCov = 0.0;

  for (int i = 0; i < 12; i++) {
    if (i >= u_count) break;
    vec2 uv = shiftedUv(i);
    vec4 t = texture(u_plates[i], uv);
    float cov = t.r;
    float knockout = t.g;
    float trap = t.b;
    float hole = t.a;
    if (u_halftone == 1 && cov > 0.001)
      cov *= halftoneDot(v_uv, u_angle[i], cov);

    float inkAmt = cov * u_opacity[i];
    if (inkAmt > 0.001) {
      // 挖空掩膜命中且不在字孔内：下层归零回纸色；叠印对象无挖空掩膜，保留下层
      if (knockout > 0.5 && hole < 0.5) acc = u_paper;
      acc = mix(acc, u_ink[i], inkAmt);
    } else if (trap > 0.001 && hole < 0.5) {
      // 陷印扩展带：补本版墨色，字孔内不补 -> 不堵字孔
      acc = mix(acc, u_ink[i], trap * u_opacity[i]);
    }
    maxCov = max(maxCov, cov);
  }

  // 漏白定位：邻域有墨而当前几乎无墨 -> 红色警示
  if (u_leakLocate == 1 && maxCov < 0.02) {
    float neighbor = 0.0;
    for (int i = 0; i < 12; i++) {
      if (i >= u_count) break;
      for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
          if (dx == 0 && dy == 0) continue;
          vec2 nuv = clamp(
            v_uv + (vec2(float(dx), float(dy)) * u_leakPx) / u_texSize,
            vec2(0.0), vec2(1.0));
          neighbor = max(neighbor, texture(u_plates[i], nuv).r);
        }
      }
    }
    if (neighbor > 0.25) acc = mix(acc, vec3(0.9, 0.08, 0.08), 0.85);
  }

  // 纸色衬底强度
  acc = mix(vec3(1.0), acc, u_paperOpacity);
  frag = vec4(acc, 1.0);
}`
