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
  vec3 base = texture2D(u_tex, toTexUv(v_uv)).rgb;

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
        vec3 V = vec3(0.0, 0.0, 1.0);
        vec3 L = normalize(vec3(-0.38, -0.52, 0.76));
        vec3 Hh = normalize(L + V);
        float specW = pow(max(0.0, dot(Nsun, Hh)), 118.0) * mask * (0.45 + 0.55 * inner);
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
        dropletCol = mix(bgLocal, dropletCol, mask);

        vec2 sh = c + vec2(-0.018, -0.026) * u_resolution.y;
        float pr = min(urx, ury) * 0.18;
        float shA = smoothstep(pr * 10.0, 0.0, length(frag - sh)) * 0.42 * (1.0 - inner * 0.35);
        dropletCol = mix(dropletCol, dropletCol * vec3(0.48, 0.36, 0.26), shA);

        dropletCol += vec3(0.97, 0.98, 1.0) * specW * 0.14;
        dropletCol = mix(dropletCol, vec3(1.0), fres * mask * 0.075);
        dropletCol += vec3(0.9, 0.93, 1.0) * rimW * 0.11;

        float edge = smoothstep(aa * 0.95, -aa * 0.35, dSurf) * (1.0 - inner) * 0.18;
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

/** 좁은 화면에서는 캔버스 높이를 줄여 본문·슬라이더가 같은 화면에 보이도록 */
function canvasSizeForViewport(): { w: number; h: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(1100, Math.max(200, vw - 8))
  if (vw <= 640) {
    const h = Math.min(680, Math.max(240, Math.floor(vh * 0.42)))
    return { w, h }
  }
  return { w, h: Math.min(1400, Math.max(320, vh - 8)) }
}

function main() {
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
  g.uniform2f(uTexSize, texCanvas.width, texCanvas.height)

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
    if (dropCountVal) dropCountVal.textContent = `${n}개`
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

  attachGuideSelfTest()
}

main()
