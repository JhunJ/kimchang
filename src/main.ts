import {
  clampDropSizeScale,
  DEFAULT_DROP_COUNT,
  DEFAULT_DROP_SIZE_SCALE,
  DROP_SIZE_SCALE_MAX,
  DROP_SIZE_SCALE_MIN,
  ensureSimulation,
  getDropCount,
  getDropSizeScale,
  getDropUniformBatch,
  getSelectedDropIndex,
  getSelectionHighlightActive,
  MAX_DROPS,
  MIN_DROP_COUNT,
  onMultiDropPointerDown,
  refreshDropRadiusForHeight,
  resetSimulation,
  resizeDropSimulation,
  setDropCount,
  setDropSizeScale,
  setMoveGoalForDrop,
  stepSimulation,
} from './waterDroplet'
import {
  clampFontSizePx,
  DEFAULT_BACKGROUND_TEXT,
  DEFAULT_FONT_SIZE_PX,
  MAX_FONT_SIZE_PX,
  MIN_FONT_SIZE_PX,
  renderNewspaperTexture,
} from './newspaper'
import { WetTrail } from './wetTrail'
import { attachGuideSelfTest } from './guideSelfTest'
import {
  applyPageLanguage,
  formatDropCountVal,
  getCurrentLang,
  getStoredLang,
  initI18nUi,
} from './i18n'

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

/** 반타원체 상면 — 다중 방울 순차 합성 + 굴절·광원 */
const FRAG = `
#define MAX_DROPS ${MAX_DROPS}
precision highp float;
varying vec2 v_uv;
uniform vec2 u_resolution;
uniform vec2 u_texSize;
uniform sampler2D u_tex;
uniform int u_dropCount;
uniform float u_centerX[MAX_DROPS];
uniform float u_centerY[MAX_DROPS];
uniform float u_rx[MAX_DROPS];
uniform float u_ry[MAX_DROPS];
uniform float u_cosA[MAX_DROPS];
uniform float u_sinA[MAX_DROPS];
uniform float u_zScale[MAX_DROPS];
uniform float u_ior[MAX_DROPS];
uniform float u_tailPinch[MAX_DROPS];
uniform float u_headBulge[MAX_DROPS];
uniform float u_rearRipple[MAX_DROPS];
uniform float u_ripplePhase[MAX_DROPS];
uniform int u_selectedIdx;
uniform int u_highlightSel;
uniform sampler2D u_wet;
uniform float u_lightAngle;
uniform float u_glassBlend;
uniform float u_shadowMix;
uniform float u_causticMix;
uniform float u_satInDrop;

vec2 toTexUv(vec2 uv) {
  float cw = u_resolution.x;
  float ch = u_resolution.y;
  float tw = u_texSize.x;
  float th = u_texSize.y;
  float s = min(cw / tw, ch / th);
  vec2 d = vec2(cw - tw * s, ch - th * s) * 0.5;
  vec2 p = (uv * u_resolution - d) / vec2(tw * s, th * s);
  return clamp(p, 0.001, 0.999);
}

void main() {
  vec2 frag = v_uv * u_resolution;
  vec2 lf = vec2(sin(u_lightAngle), -cos(u_lightAngle));
  vec2 lfN = normalize(lf + vec2(1e-5));

  float shAcc = 0.0;
  float cAcc = 0.0;
  for (int si = 0; si < MAX_DROPS; si++) {
    if (si < u_dropCount) {
    float urx = u_rx[si];
    float ury = u_ry[si];
    if (urx > 0.5) {
    vec2 c = vec2(u_centerX[si], u_centerY[si]);
    vec2 d0 = frag - c;
    vec2 p = vec2(u_cosA[si] * d0.x - u_sinA[si] * d0.y, u_sinA[si] * d0.x + u_cosA[si] * d0.y);
    float ell = length(vec2(p.x / urx, p.y / ury));
    float maskApprox = smoothstep(1.14, 0.0, ell);
    float Rm = max(urx, ury);
    vec2 shC = c - lfN * Rm * 1.38;
    float dSh = length(frag - shC);
    float elong = 1.0 + 0.42 * abs(dot(normalize(frag - shC + vec2(1e-3)), lfN));
    float shBlob = smoothstep(Rm * 3.15 * elong, Rm * 0.13, dSh) * (1.0 - maskApprox * 0.93);
    float hot = exp(-(dSh * dSh) / max(1.0, Rm * Rm * 1.05)) * (1.0 - maskApprox * 0.9);
    shAcc = max(shAcc, shBlob);
    cAcc = max(cAcc, hot * sqrt(shBlob + 0.04));
    }
    }
  }

  vec3 base = texture2D(u_tex, toTexUv(v_uv)).rgb;
  base = mix(base, base * vec3(0.76, 0.60, 0.45), min(1.0, shAcc * u_shadowMix));
  base += vec3(1.0, 0.76, 0.42) * min(0.52, cAcc * u_causticMix);

  vec3 L = normalize(vec3(lfN.x * 0.78, lfN.y * 0.78, 0.58));
  vec3 V = vec3(0.0, 0.0, 1.0);

  for (int idx = 0; idx < MAX_DROPS; idx++) {
    if (idx < u_dropCount) {
      float urx = u_rx[idx];
      float ury = u_ry[idx];
      if (urx > 0.5) {
        vec2 c = vec2(u_centerX[idx], u_centerY[idx]);
        vec2 d0 = frag - c;
        vec2 p = vec2(u_cosA[idx] * d0.x - u_sinA[idx] * d0.y, u_sinA[idx] * d0.x + u_cosA[idx] * d0.y);

        float pu = p.x / urx;
        float pv = p.y / ury;
        float phi = atan(pv, pu);
        float muBack = (1.0 - cos(phi)) * 0.5;
        float muFront = (1.0 + cos(phi)) * 0.5;
        float neck = 1.0 - u_tailPinch[idx] * muBack;
        float headB = 1.0 + u_headBulge[idx] * muFront;
        float ripW = smoothstep(0.0, 0.045, u_rearRipple[idx]);
        float rip = 1.0 + u_rearRipple[idx] * ripW * sin(3.0 * phi + u_ripplePhase[idx]) * muBack * muBack;
        float w = length(vec2(pu, pv)) / max(0.22, neck * headB * rip);
        float w2 = w * w;
        float dSurf = (w - 1.0) * min(urx, ury);

        float aa = 2.4;
        float mask = 1.0 - smoothstep(-aa, aa, dSurf);
        float inner = smoothstep(1.05, 0.0, w);

        vec3 N = vec3(0.0, 0.0, 1.0);
        float z = 0.0;
        float H = u_zScale[idx];
        if (w2 < 0.9999) {
          float zn = sqrt(1.0 - w2);
          z = H * zn;
          N = normalize(vec3(
            p.x / (urx * urx),
            p.y / (ury * ury),
            z / (H * H)
          ));
        }

        float Rm = max(urx, ury);
        float ru = length(d0);
        vec3 Nsun = N;
        if (ru < Rm * 0.9995) {
          float zs = sqrt(max(0.0, Rm * Rm - ru * ru));
          Nsun = normalize(vec3(d0.x, d0.y, zs));
        }
        vec3 Hh = normalize(L + V);
        float specW = pow(max(0.0, dot(Nsun, Hh)), 122.0) * mask * (0.4 + 0.6 * inner);
        float cosT = max(dot(N, V), 0.0);
        float etaI = 1.0;
        float etaT = u_ior[idx];
        float F0 = pow((etaI - etaT) / (etaI + etaT), 2.0);
        float fres = F0 + (1.0 - F0) * pow(1.0 - cosT, 5.0);
        float rimW = pow(1.0 - cosT, 3.0) * mask;

        float parallax = (1.0 - 1.0 / u_ior[idx]) * (28.0 + z * 0.45);
        vec2 refrPx = N.xy * parallax;
        vec2 uvR = (frag + refrPx) / u_resolution;
        float du = 1.2 / u_resolution.x;
        vec3 baseR = texture2D(u_tex, toTexUv(uvR + vec2(du, 0.0))).rgb;
        vec3 baseG = texture2D(u_tex, toTexUv(uvR)).rgb;
        vec3 baseB = texture2D(u_tex, toTexUv(uvR - vec2(du, 0.0))).rgb;
        vec3 dropletCol = vec3(baseR.r, baseG.g, baseB.b);

        vec3 bgLocal = texture2D(u_tex, toTexUv(v_uv)).rgb;
        float glass = mask * u_glassBlend;
        dropletCol = mix(bgLocal, dropletCol, glass);

        vec2 warmPt = c - lfN * min(urx, ury) * 0.42;
        float pr = min(urx, ury) * 0.2;
        float shA = smoothstep(pr * 9.0, 0.0, length(frag - warmPt)) * 0.38 * (1.0 - inner * 0.4);
        dropletCol = mix(dropletCol, dropletCol * vec3(0.52, 0.38, 0.24), shA);

        float lu = dot(dropletCol, vec3(0.299, 0.587, 0.114));
        float sFac = clamp(1.0 + u_satInDrop * mask, 1.0, 1.42);
        dropletCol = mix(vec3(lu), dropletCol, sFac);

        dropletCol += vec3(0.97, 0.98, 1.0) * specW * 0.11;
        dropletCol = mix(dropletCol, vec3(1.0), fres * mask * 0.055);
        dropletCol += vec3(0.9, 0.93, 1.0) * rimW * 0.085;

        float edge = smoothstep(aa * 0.95, -aa * 0.35, dSurf) * (1.0 - inner) * 0.12;
        dropletCol += edge;

        float isSel = float(idx == u_selectedIdx) * float(u_highlightSel);
        float ring = mask * (1.0 - inner);
        dropletCol += vec3(0.62, 0.84, 1.0) * isSel * ring * 0.22;
        dropletCol *= (1.0 + 0.028 * isSel * mask);

        base = mix(base, dropletCol, mask);
      }
    }
  }

  float wt = texture2D(u_wet, v_uv).r;
  base = mix(base, base * vec3(0.82, 0.74, 0.64), wt * 0.62);

  float vig = smoothstep(1.12, 0.38, length((v_uv - 0.5) * vec2(1.08, 1.0)));
  base *= 0.94 + 0.06 * vig;

  gl_FragColor = vec4(base, 1.0);
}
`

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed')
  }
  return sh
}

const BG_TEXT_STORAGE_KEY = 'kimchang-newspaper-text'
const BG_FONT_STORAGE_KEY = 'kimchang-newspaper-font-px'
const DROP_SIZE_STORAGE_KEY = 'kimchang-drop-size-scale'
const DROP_COUNT_STORAGE_KEY = 'kimchang-drop-count'
const LIGHT_DEG_STORAGE_KEY = 'kimchang-light-deg'
const GLASS_PCT_STORAGE_KEY = 'kimchang-glass-pct'
const VFX_SHADOW_PCT_STORAGE_KEY = 'kimchang-vfx-shadow-pct'
const SAT_PCT_STORAGE_KEY = 'kimchang-sat-pct'

const DEFAULT_LIGHT_DEG = 180
const DEFAULT_GLASS_PCT = 72
const DEFAULT_VFX_SHADOW_PCT = 68
const DEFAULT_SAT_PCT = 38

function readStoredLightDeg(): number {
  try {
    const s = localStorage.getItem(LIGHT_DEG_STORAGE_KEY)
    if (s == null) return DEFAULT_LIGHT_DEG
    const n = parseFloat(s)
    if (Number.isNaN(n)) return DEFAULT_LIGHT_DEG
    return ((n % 360) + 360) % 360
  } catch {
    return DEFAULT_LIGHT_DEG
  }
}

function readStoredPct(
  key: string,
  def: number,
  min: number,
  max: number,
): number {
  try {
    const s = localStorage.getItem(key)
    if (s == null) return def
    const n = parseInt(s, 10)
    if (Number.isNaN(n)) return def
    return Math.max(min, Math.min(max, n))
  } catch {
    return def
  }
}

function readStoredDropCount(): number {
  const s = localStorage.getItem(DROP_COUNT_STORAGE_KEY)
  if (s == null) return DEFAULT_DROP_COUNT
  const n = parseInt(s, 10)
  if (Number.isNaN(n)) return DEFAULT_DROP_COUNT
  return Math.max(MIN_DROP_COUNT, Math.min(MAX_DROPS, n))
}

function readStoredDropScale(): number {
  const s = localStorage.getItem(DROP_SIZE_STORAGE_KEY)
  if (s == null) return DEFAULT_DROP_SIZE_SCALE
  const n = parseFloat(s)
  if (Number.isNaN(n)) return DEFAULT_DROP_SIZE_SCALE
  return clampDropSizeScale(n)
}

function readStoredFontPx(): number {
  const s = localStorage.getItem(BG_FONT_STORAGE_KEY)
  if (s == null) return DEFAULT_FONT_SIZE_PX
  const n = parseInt(s, 10)
  if (Number.isNaN(n)) return DEFAULT_FONT_SIZE_PX
  return clampFontSizePx(n)
}

/**
 * 캔버스 내부 해상도 — 좌우 분할(≥768px)일 때 왼쪽 열 폭에 맞추고,
 * 모바일에서는 헤더 아래 남는 높이의 일부만 사용해 패널과 한 화면에 두기 쉽게 함.
 */
function canvasSizeForViewport(): { w: number; h: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const topbar = 46
  const availH = Math.max(200, vh - topbar - 12)

  if (vw >= 768) {
    const colW = Math.max(220, Math.min(720, Math.floor((vw - 24) / 2) - 6))
    const h = Math.floor(
      Math.min(availH - 4, Math.max(260, colW * 0.78), 620),
    )
    const w = Math.floor(Math.min(colW, Math.max(220, h * 1.28)))
    return { w, h }
  }

  const w = Math.min(1100, Math.max(200, vw - 8))
  const h = Math.min(360, Math.max(200, Math.floor(availH * 0.4)))
  return { w, h }
}

function main() {
  applyPageLanguage(getStoredLang())

  const { w: W, h: H } = canvasSizeForViewport()
  const initialBg =
    localStorage.getItem(BG_TEXT_STORAGE_KEY) ?? DEFAULT_BACKGROUND_TEXT
  const initialFontPx = readStoredFontPx()
  const texCanvas = renderNewspaperTexture(
    1200,
    1500,
    initialBg,
    initialFontPx,
  )

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  canvas.style.touchAction = 'none'
  canvas.style.cursor = 'grab'
  const stage = document.getElementById('stage')
  if (stage) stage.appendChild(canvas)
  else document.getElementById('app')!.appendChild(canvas)

  function toCanvasXY(clientX: number, clientY: number) {
    const r = canvas.getBoundingClientRect()
    const sx = canvas.width / r.width
    const sy = canvas.height / r.height
    return {
      x: (clientX - r.left) * sx,
      y: (clientY - r.top) * sy,
    }
  }

  let pointerDown = false
  /** 방울 1개일 때만 드래그로 목표 추적 */
  let dragMovesGoal = false

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    pointerDown = true
    canvas.style.cursor = 'grabbing'
    canvas.setPointerCapture(e.pointerId)
    const { x, y } = toCanvasXY(e.clientX, e.clientY)
    const cnt = getDropCount()
    if (cnt <= 1) {
      setMoveGoalForDrop(0, x, y)
      dragMovesGoal = true
    } else {
      onMultiDropPointerDown(x, y)
      dragMovesGoal = false
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!pointerDown || !dragMovesGoal) return
    e.preventDefault()
    const { x, y } = toCanvasXY(e.clientX, e.clientY)
    setMoveGoalForDrop(0, x, y)
  }

  const endPointer = (e: PointerEvent) => {
    pointerDown = false
    dragMovesGoal = false
    canvas.style.cursor = 'grab'
    try {
      canvas.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  const peOpts = { passive: false } as AddEventListenerOptions
  canvas.addEventListener('pointerdown', onPointerDown, peOpts)
  canvas.addEventListener('pointermove', onPointerMove, peOpts)
  canvas.addEventListener('pointerup', endPointer, peOpts)
  canvas.addEventListener('pointercancel', endPointer, peOpts)
  canvas.addEventListener(
    'pointerleave',
    (e: PointerEvent) => {
      if (pointerDown) endPointer(e)
    },
    peOpts,
  )

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: true,
    preserveDrawingBuffer: false,
  })
  if (!gl) throw new Error('WebGL unavailable')
  const g = gl

  const vs = compile(g, g.VERTEX_SHADER, VERT)
  const fs = compile(g, g.FRAGMENT_SHADER, FRAG)
  const prog = g.createProgram()!
  g.attachShader(prog, vs)
  g.attachShader(prog, fs)
  g.linkProgram(prog)
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
    throw new Error(g.getProgramInfoLog(prog) || 'link failed')
  }
  g.useProgram(prog)

  const buf = g.createBuffer()!
  g.bindBuffer(g.ARRAY_BUFFER, buf)
  g.bufferData(
    g.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    g.STATIC_DRAW,
  )
  const loc = g.getAttribLocation(prog, 'a_pos')
  g.enableVertexAttribArray(loc)
  g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)

  const texture = g.createTexture()!
  g.activeTexture(g.TEXTURE0)
  g.bindTexture(g.TEXTURE_2D, texture)
  g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, 1)
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, texCanvas)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)

  g.uniform1i(g.getUniformLocation(prog, 'u_tex'), 0)
  g.uniform1i(g.getUniformLocation(prog, 'u_wet'), 1)

  const uRes = g.getUniformLocation(prog, 'u_resolution')
  const uTexSize = g.getUniformLocation(prog, 'u_texSize')
  const uDropCount = g.getUniformLocation(prog, 'u_dropCount')
  const uCenterX = g.getUniformLocation(prog, 'u_centerX')
  const uCenterY = g.getUniformLocation(prog, 'u_centerY')
  const uRx = g.getUniformLocation(prog, 'u_rx')
  const uRy = g.getUniformLocation(prog, 'u_ry')
  const uCosA = g.getUniformLocation(prog, 'u_cosA')
  const uSinA = g.getUniformLocation(prog, 'u_sinA')
  const uZScale = g.getUniformLocation(prog, 'u_zScale')
  const uIor = g.getUniformLocation(prog, 'u_ior')
  const uTailPinch = g.getUniformLocation(prog, 'u_tailPinch')
  const uHeadBulge = g.getUniformLocation(prog, 'u_headBulge')
  const uRearRipple = g.getUniformLocation(prog, 'u_rearRipple')
  const uRipplePhase = g.getUniformLocation(prog, 'u_ripplePhase')
  const uSelectedIdx = g.getUniformLocation(prog, 'u_selectedIdx')
  const uHighlightSel = g.getUniformLocation(prog, 'u_highlightSel')
  const uLightAngle = g.getUniformLocation(prog, 'u_lightAngle')
  const uGlassBlend = g.getUniformLocation(prog, 'u_glassBlend')
  const uShadowMix = g.getUniformLocation(prog, 'u_shadowMix')
  const uCausticMix = g.getUniformLocation(prog, 'u_causticMix')
  const uSatInDrop = g.getUniformLocation(prog, 'u_satInDrop')
  g.uniform2f(uTexSize, texCanvas.width, texCanvas.height)

  let lightDeg = readStoredLightDeg()
  let glassPct = readStoredPct(
    GLASS_PCT_STORAGE_KEY,
    DEFAULT_GLASS_PCT,
    25,
    100,
  )
  let vfxShadowPct = readStoredPct(
    VFX_SHADOW_PCT_STORAGE_KEY,
    DEFAULT_VFX_SHADOW_PCT,
    0,
    100,
  )
  let satPct = readStoredPct(SAT_PCT_STORAGE_KEY, DEFAULT_SAT_PCT, 0, 100)

  function syncLightingUniforms() {
    const rad = (lightDeg * Math.PI) / 180
    g.uniform1f(uLightAngle, rad)
    const glassBlend = 0.34 + (glassPct / 100) * 0.56
    g.uniform1f(uGlassBlend, glassBlend)
    const sm = (vfxShadowPct / 100) * 0.82
    g.uniform1f(uShadowMix, sm)
    g.uniform1f(uCausticMix, (vfxShadowPct / 100) * 0.64)
    g.uniform1f(uSatInDrop, (satPct / 100) * 0.44)
  }

  function persistLighting() {
    try {
      localStorage.setItem(LIGHT_DEG_STORAGE_KEY, String(lightDeg))
      localStorage.setItem(GLASS_PCT_STORAGE_KEY, String(glassPct))
      localStorage.setItem(VFX_SHADOW_PCT_STORAGE_KEY, String(vfxShadowPct))
      localStorage.setItem(SAT_PCT_STORAGE_KEY, String(satPct))
    } catch {
      /* ignore */
    }
  }

  function updateLightDialCss() {
    const dialEl = document.getElementById('light-dial')
    if (dialEl) {
      dialEl.style.setProperty('--light-deg', `${lightDeg.toFixed(2)}deg`)
      dialEl.setAttribute('aria-valuenow', String(Math.round(lightDeg)))
    }
    const degEl = document.getElementById('light-dial-deg')
    if (degEl) degEl.textContent = `${Math.round(lightDeg)}°`
  }

  function attachLightDial() {
    const dial = document.getElementById('light-dial')
    if (!dial) return
    let dragging = false
    const setFromClient = (cx: number, cy: number) => {
      const r = dial.getBoundingClientRect()
      const mx = r.left + r.width * 0.5
      const my = r.top + r.height * 0.5
      let deg = (Math.atan2(cx - mx, -(cy - my)) * 180) / Math.PI
      if (deg < 0) deg += 360
      lightDeg = deg
      updateLightDialCss()
      persistLighting()
    }
    dial.addEventListener('pointerdown', (e) => {
      dragging = true
      dial.setPointerCapture(e.pointerId)
      setFromClient(e.clientX, e.clientY)
    })
    dial.addEventListener('pointermove', (e) => {
      if (!dragging) return
      setFromClient(e.clientX, e.clientY)
    })
    const end = () => {
      dragging = false
    }
    dial.addEventListener('pointerup', end)
    dial.addEventListener('pointercancel', end)
    dial.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 5 : 1
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        lightDeg = (lightDeg + step + 360) % 360
        updateLightDialCss()
        persistLighting()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        lightDeg = (lightDeg - step + 360) % 360
        updateLightDialCss()
        persistLighting()
      }
    })
    updateLightDialCss()
  }

  const glassRange = document.getElementById('drop-glass') as HTMLInputElement | null
  const glassVal = document.getElementById('drop-glass-val')
  const shadowRange = document.getElementById('drop-vfx-shadow') as HTMLInputElement | null
  const shadowVal = document.getElementById('drop-vfx-shadow-val')
  const satRange = document.getElementById('drop-sat') as HTMLInputElement | null
  const satVal = document.getElementById('drop-sat-val')

  const syncGlassUi = () => {
    if (glassRange) glassRange.value = String(glassPct)
    if (glassVal) glassVal.textContent = `${glassPct}%`
  }
  const syncShadowUi = () => {
    if (shadowRange) shadowRange.value = String(vfxShadowPct)
    if (shadowVal) shadowVal.textContent = `${vfxShadowPct}%`
  }
  const syncSatUi = () => {
    if (satRange) satRange.value = String(satPct)
    if (satVal) satVal.textContent = `${satPct}%`
  }
  syncGlassUi()
  syncShadowUi()
  syncSatUi()

  if (glassRange) {
    glassRange.addEventListener('input', () => {
      glassPct = parseInt(glassRange.value, 10)
      syncGlassUi()
      persistLighting()
    })
  }
  if (shadowRange) {
    shadowRange.addEventListener('input', () => {
      vfxShadowPct = parseInt(shadowRange.value, 10)
      syncShadowUi()
      persistLighting()
    })
  }
  if (satRange) {
    satRange.addEventListener('input', () => {
      satPct = parseInt(satRange.value, 10)
      syncSatUi()
      persistLighting()
    })
  }

  attachLightDial()

  const bgTextEl = document.getElementById('bg-text') as HTMLTextAreaElement | null
  const bgFontRange = document.getElementById(
    'bg-font-size',
  ) as HTMLInputElement | null
  const bgFontVal = document.getElementById('bg-font-size-val')
  const bgFontRow = document.querySelector('.font-size-row')

  let bgFontPx = initialFontPx

  if (bgTextEl) {
    bgTextEl.value = initialBg
    if (bgFontRange) {
      bgFontRange.min = String(MIN_FONT_SIZE_PX)
      bgFontRange.max = String(MAX_FONT_SIZE_PX)
      bgFontRange.value = String(bgFontPx)
    }
    if (bgFontVal) bgFontVal.textContent = `${bgFontPx}px`

    const applyBackgroundTexture = () => {
      const raw = bgTextEl.value
      try {
        localStorage.setItem(BG_TEXT_STORAGE_KEY, raw)
        localStorage.setItem(BG_FONT_STORAGE_KEY, String(bgFontPx))
      } catch {
        /* 저장 실패 무시 */
      }
      const c = renderNewspaperTexture(1200, 1500, raw, bgFontPx)
      g.activeTexture(g.TEXTURE0)
      g.bindTexture(g.TEXTURE_2D, texture)
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, 1)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, c)
      g.uniform2f(uTexSize!, c.width, c.height)
    }

    const setFontPx = (next: number) => {
      bgFontPx = clampFontSizePx(next)
      if (bgFontRange) bgFontRange.value = String(bgFontPx)
      if (bgFontVal) bgFontVal.textContent = `${bgFontPx}px`
      applyBackgroundTexture()
    }

    let bgDebounce: number | undefined
    bgTextEl.addEventListener('input', () => {
      const v = bgTextEl.value
      if (bgDebounce !== undefined) window.clearTimeout(bgDebounce)
      bgDebounce = window.setTimeout(() => {
        bgDebounce = undefined
        applyBackgroundTexture()
      }, 320)
    })

    if (bgFontRange) {
      bgFontRange.addEventListener('input', () => {
        setFontPx(parseInt(bgFontRange.value, 10))
      })
    }

    if (bgFontRow) {
      bgFontRow.addEventListener(
        'wheel',
        (e: Event) => {
          const we = e as WheelEvent
          we.preventDefault()
          const delta = we.deltaY > 0 ? -1 : 1
          setFontPx(bgFontPx + delta)
        },
        { passive: false },
      )
    }
  }

  setDropSizeScale(readStoredDropScale())
  setDropCount(readStoredDropCount())

  const dropSizeRange = document.getElementById(
    'drop-size',
  ) as HTMLInputElement | null
  const dropSizeVal = document.getElementById('drop-size-val')
  const dropSizeRow = document.getElementById('drop-size-row')

  const syncDropSizeUi = () => {
    const pct = Math.round(getDropSizeScale() * 100)
    if (dropSizeRange) {
      dropSizeRange.min = String(Math.round(DROP_SIZE_SCALE_MIN * 100))
      dropSizeRange.max = String(Math.round(DROP_SIZE_SCALE_MAX * 100))
      dropSizeRange.value = String(pct)
    }
    if (dropSizeVal) dropSizeVal.textContent = `${pct}%`
  }

  const applyDropSizePercent = (percentInt: number) => {
    const sc = clampDropSizeScale(percentInt / 100)
    setDropSizeScale(sc)
    try {
      localStorage.setItem(DROP_SIZE_STORAGE_KEY, String(sc))
    } catch {
      /* ignore */
    }
    refreshDropRadiusForHeight(canvas.height)
    syncDropSizeUi()
  }

  syncDropSizeUi()

  if (dropSizeRange) {
    dropSizeRange.addEventListener('input', () => {
      applyDropSizePercent(parseInt(dropSizeRange.value, 10))
    })
  }

  if (dropSizeRow) {
    dropSizeRow.addEventListener(
      'wheel',
      (e: Event) => {
        const we = e as WheelEvent
        we.preventDefault()
        const cur = Math.round(getDropSizeScale() * 100)
        const delta = we.deltaY > 0 ? -2 : 2
        applyDropSizePercent(cur + delta)
      },
      { passive: false },
    )
  }

  const dropCountRange = document.getElementById(
    'drop-count',
  ) as HTMLInputElement | null
  const dropCountVal = document.getElementById('drop-count-val')
  const dropCountRow = document.getElementById('drop-count-row')

  const syncDropCountUi = () => {
    const n = getDropCount()
    if (dropCountRange) {
      dropCountRange.min = String(MIN_DROP_COUNT)
      dropCountRange.max = String(MAX_DROPS)
      dropCountRange.value = String(n)
    }
    if (dropCountVal)
      dropCountVal.textContent = formatDropCountVal(getCurrentLang(), n)
  }

  ensureSimulation(canvas.width, canvas.height)

  const wet = new WetTrail(g)
  wet.resize(canvas.width, canvas.height)

  const applyDropCount = (n: number) => {
    const prev = getDropCount()
    setDropCount(n)
    try {
      localStorage.setItem(DROP_COUNT_STORAGE_KEY, String(getDropCount()))
    } catch {
      /* ignore */
    }
    resizeDropSimulation(canvas.width, canvas.height, prev)
    wet.clear()
    syncDropCountUi()
  }

  syncDropCountUi()

  if (dropCountRange) {
    dropCountRange.addEventListener('input', () => {
      applyDropCount(parseInt(dropCountRange.value, 10))
    })
  }

  if (dropCountRow) {
    dropCountRow.addEventListener(
      'wheel',
      (e: Event) => {
        const we = e as WheelEvent
        we.preventDefault()
        const cur = getDropCount()
        const delta = we.deltaY > 0 ? -1 : 1
        applyDropCount(cur + delta)
      },
      { passive: false },
    )
  }

  let start = performance.now()
  let prev = start
  function frame(now: number) {
    const dt = Math.min(0.05, (now - prev) / 1000)
    prev = now

    stepSimulation(canvas.width, canvas.height, dt, (now - start) / 1000)
    const ub = getDropUniformBatch(
      canvas.height,
      (now - start) / 1000,
      dt,
    )

    wet.resize(canvas.width, canvas.height)
    const decay = Math.pow(0.971, dt * 60)
    const stampIgnoreSpeed =
      pointerDown && getDropCount() <= 1 && dragMovesGoal
    for (let i = 0; i < ub.count; i++) {
      let stampGain = 1
      if (!stampIgnoreSpeed) {
        stampGain = Math.min(1, ub.speedPx[i] / 78)
        if (ub.speedPx[i] < 7) stampGain = 0
      }
      wet.step(
        ub.centerX[i],
        ub.centerYGl[i],
        decay,
        ub.wetStampAx[i],
        ub.wetStampBy[i],
        ub.cosA[i],
        ub.sinA[i],
        stampGain,
      )
    }

    g.activeTexture(g.TEXTURE0)
    g.bindTexture(g.TEXTURE_2D, texture)
    g.activeTexture(g.TEXTURE1)
    g.bindTexture(g.TEXTURE_2D, wet.getTexture())

    g.useProgram(prog)
    syncLightingUniforms()
    g.uniform1i(uDropCount!, ub.count)
    g.uniform1i(uSelectedIdx!, getSelectedDropIndex())
    g.uniform1i(
      uHighlightSel!,
      getDropCount() > 1 && getSelectionHighlightActive() ? 1 : 0,
    )
    g.uniform1fv(uCenterX!, ub.centerX)
    g.uniform1fv(uCenterY!, ub.centerYGl)
    g.uniform1fv(uRx!, ub.radiusX)
    g.uniform1fv(uRy!, ub.radiusY)
    g.uniform1fv(uCosA!, ub.cosA)
    g.uniform1fv(uSinA!, ub.sinA)
    g.uniform1fv(uZScale!, ub.zScale)
    g.uniform1fv(uIor!, ub.ior)
    g.uniform1fv(uTailPinch!, ub.tailPinch)
    g.uniform1fv(uHeadBulge!, ub.headBulge)
    g.uniform1fv(uRearRipple!, ub.rearRipple)
    g.uniform1fv(uRipplePhase!, ub.ripplePhase)

    g.viewport(0, 0, canvas.width, canvas.height)
    g.uniform2f(uRes, canvas.width, canvas.height)
    g.drawArrays(g.TRIANGLES, 0, 6)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  let resizeT: number | undefined
  window.addEventListener('resize', () => {
    pointerDown = false
    dragMovesGoal = false
    if (resizeT !== undefined) window.clearTimeout(resizeT)
    resizeT = window.setTimeout(() => {
      resizeT = undefined
      const { w, h } = canvasSizeForViewport()
      canvas.width = w
      canvas.height = h
      resetSimulation(canvas.width, canvas.height)
      wet.resize(canvas.width, canvas.height)
      wet.clear()
    }, 120)
  })

  initI18nUi(() => {
    syncDropCountUi()
  })
  attachGuideSelfTest()
}

main()
