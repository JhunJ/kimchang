/**
 * 물방울 이동만 시뮬레이션 — 렌더는 셰이더에서 반구(세션 방울) 해석적 모델.
 * 방울마다 목표점이 따로 있으며, 선택된 방울만 포인터로 목표를 바꿈(다중일 때).
 */

/** 셰이더·유니폼 배열 크기와 동일 — 너무 크면 일부 GPU에서 프래그먼트 유니폼 한도 초과 가능 */
export const MAX_DROPS = 64
export const MIN_DROP_COUNT = 1
export const DEFAULT_DROP_COUNT = 1

let dropCount = DEFAULT_DROP_COUNT

type DropState = {
  cx: number
  cy: number
  cvx: number
  cvy: number
  /** DOM 좌표 — 이 점을 향해 스프링 */
  targetX: number
  targetY: number
  stretchSmooth: number
  pinchSmooth: number
  rippleSmooth: number
  dirSmX: number
  dirSmY: number
  ripplePhaseAccum: number
}

function createDropState(): DropState {
  return {
    cx: 0,
    cy: 0,
    cvx: 0,
    cvy: 0,
    targetX: 0,
    targetY: 0,
    stretchSmooth: 1,
    pinchSmooth: 0,
    rippleSmooth: 0,
    dirSmX: 1,
    dirSmY: 0,
    ripplePhaseAccum: 0,
  }
}

const drops: DropState[] = Array.from({ length: MAX_DROPS }, createDropState)

/** 다중일 때 포인터로 목표를 옮길 방울 인덱스 */
let selectedDropIndex = 0

/** 다중 방울에서만 — 방울을 탭해 선택했을 때만 true. 꺼지면 하이라이트·빈 곳 이동 둘 다 없음 */
let selectionHighlightActive = false

export function getSelectionHighlightActive(): boolean {
  return selectionHighlightActive
}

/** 픽셀 — reset 시 canvas 높이·크기 배율에 비례 */
let dropRadiusPx = 0
let simReady = false

/** 기본 반경(높이 비례)에 곱하는 배율 — 슬라이더·저장용 */
export const DROP_SIZE_SCALE_MIN = 0.35
export const DROP_SIZE_SCALE_MAX = 2.8
export const DEFAULT_DROP_SIZE_SCALE = 1

let dropSizeScale = DEFAULT_DROP_SIZE_SCALE

export function clampDropSizeScale(s: number): number {
  return clamp(s, DROP_SIZE_SCALE_MIN, DROP_SIZE_SCALE_MAX)
}

export function setDropSizeScale(s: number) {
  dropSizeScale = clampDropSizeScale(s)
}

export function getDropSizeScale(): number {
  return dropSizeScale
}

function computeDropRadiusPx(height: number): number {
  const base = clamp(height * 0.046, 36, 72)
  const scaled = base * dropSizeScale
  return clamp(scaled, 10, Math.min(210, height * 0.14))
}

/** 리사이즈 없이 배율만 바꿀 때 — 위치·속도는 유지 */
export function refreshDropRadiusForHeight(height: number) {
  dropRadiusPx = computeDropRadiusPx(height)
}

export function setDropCount(n: number) {
  dropCount = clamp(Math.floor(n), MIN_DROP_COUNT, MAX_DROPS)
  selectedDropIndex = Math.min(selectedDropIndex, dropCount - 1)
  selectionHighlightActive = false
}

export function getDropCount(): number {
  return dropCount
}

export function getSelectedDropIndex(): number {
  return selectedDropIndex
}

export function setSelectedDropIndex(i: number) {
  selectedDropIndex = clamp(Math.floor(i), 0, Math.max(0, dropCount - 1))
}

/** 캔버스 좌표(DOM y)에서 가장 가까운 방울 인덱스, 없으면 -1 */
export function pickDropAt(canvasX: number, canvasY: number): number {
  const r = Math.max(dropRadiusPx * 1.38, 52)
  let best = -1
  let bestD = 1e9
  for (let i = 0; i < dropCount; i++) {
    const d = drops[i]
    const dist = Math.hypot(canvasX - d.cx, canvasY - d.cy)
    if (dist <= r && dist < bestD) {
      bestD = dist
      best = i
    }
  }
  return best
}

export function setMoveGoalForDrop(i: number, x: number, y: number) {
  const idx = clamp(Math.floor(i), 0, Math.max(0, dropCount - 1))
  drops[idx].targetX = x
  drops[idx].targetY = y
}

export function setMoveGoalForSelected(x: number, y: number) {
  if (dropCount < 1) return
  if (dropCount > 1 && !selectionHighlightActive) return
  setMoveGoalForDrop(selectedDropIndex, x, y)
}

/** dropCount > 1 일 때 pointerdown: 방울 탭은 선택/같은 방울 재탭은 하이라이트 끔, 빈 곳은 선택된 방울 이동 */
export function onMultiDropPointerDown(canvasX: number, canvasY: number) {
  const hit = pickDropAt(canvasX, canvasY)
  if (hit >= 0) {
    if (selectionHighlightActive && hit === selectedDropIndex) {
      selectionHighlightActive = false
    } else {
      selectedDropIndex = hit
      selectionHighlightActive = true
    }
    return
  }
  setMoveGoalForSelected(canvasX, canvasY)
}

function expApproach(cur: number, target: number, dt: number, tauUp: number, tauDown: number) {
  const tau = target >= cur ? tauUp : tauDown
  if (tau < 1e-5) return target
  return cur + (target - cur) * (1 - Math.exp(-dt / tau))
}

function angleToTarget(gdx: number, cy: number, targetY: number) {
  const x = Math.abs(gdx) < 1e-5 ? (gdx >= 0 ? 1e-5 : -1e-5) : gdx
  return Math.atan2(cy - targetY, x)
}

const K_PULL = 420
const DRAG_ACTIVE = 17
const DRAG_COAST = 12
const V_MAX = 2600
const ACCEL_MAX = 4200

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function smoothstep(edge0: number, edge1: number, x: number) {
  if (edge1 === edge0) return x < edge0 ? 0 : 1
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 목표 근처·정지에 가까울 때만 — 화면/젖은 자국용 미세 흔들림 (물리 cx/cy는 그대로) */
function idleWindJitterPx(
  timeSec: number,
  dropIndex: number,
  speed: number,
  distToTarget: number,
): { jx: number; jy: number } {
  const wSpeed = 1 - smoothstep(5, 34, speed)
  const wDist = 1 - smoothstep(7, 52, distToTarget)
  const idleW = wSpeed * wDist
  if (idleW < 0.02) return { jx: 0, jy: 0 }

  const t = timeSec
  const phx = dropIndex * 2.381 + 0.417
  const phy = dropIndex * 1.673 + 0.892
  const amp = 1.18 * idleW
  const jx =
    amp *
    (Math.sin(t * 1.71 + phx) + 0.38 * Math.sin(t * 4.05 + phx * 1.9))
  const jy =
    amp *
    (Math.sin(t * 1.59 + phy + 0.97) + 0.38 * Math.sin(t * 3.82 + phy * 2.1))
  return { jx, jy }
}

/** 단일 방울일 때만 의미 있음 — 호환용 */
export function setMoveGoal(x: number, y: number) {
  if (dropCount >= 1) setMoveGoalForDrop(0, x, y)
}

export function setPointerTarget(x: number, y: number) {
  setMoveGoal(x, y)
}

export function clearPointerTarget() {}

function scatterDrops(
  width: number,
  height: number,
  n: number,
  margin: number,
  minDist: number,
): { cx: number; cy: number }[] {
  const out: { cx: number; cy: number }[] = []
  const maxAttempts = 220
  for (let i = 0; i < n; i++) {
    let placed: { cx: number; cy: number } | null = null
    for (let k = 0; k < maxAttempts; k++) {
      const cx = margin + Math.random() * (width - 2 * margin)
      const cy = margin + Math.random() * (height - 2 * margin)
      let ok = true
      for (const p of out) {
        if (Math.hypot(cx - p.cx, cy - p.cy) < minDist) {
          ok = false
          break
        }
      }
      if (ok) {
        placed = { cx, cy }
        break
      }
    }
    if (!placed) {
      const cols = Math.ceil(Math.sqrt(Math.max(1, n)))
      const rows = Math.ceil(n / cols)
      const col = i % cols
      const row = Math.floor(i / cols)
      const jitter = minDist * 0.12
      placed = {
        cx:
          margin +
          ((col + 0.5) / cols) * (width - 2 * margin) +
          (Math.random() - 0.5) * jitter,
        cy:
          margin +
          ((row + 0.5) / rows) * (height - 2 * margin) +
          (Math.random() - 0.5) * jitter,
      }
    }
    out.push(placed)
  }
  return out
}

function fallbackPositionAvoiding(
  width: number,
  height: number,
  margin: number,
  minDist: number,
  anchors: { cx: number; cy: number }[],
  salt: number,
): { cx: number; cy: number } {
  const cw = width - 2 * margin
  const ch = height - 2 * margin
  const step = Math.max(28, minDist * 0.42)
  const gx = Math.max(3, Math.ceil(cw / step))
  const gy = Math.max(3, Math.ceil(ch / step))
  let best: { cx: number; cy: number; score: number } | null = null
  for (let ix = 0; ix <= gx; ix++) {
    for (let iy = 0; iy <= gy; iy++) {
      const cx = margin + (ix / Math.max(1, gx)) * cw
      const cy = margin + (iy / Math.max(1, gy)) * ch
      let minD = 1e9
      for (const p of anchors) {
        minD = Math.min(minD, Math.hypot(cx - p.cx, cy - p.cy))
      }
      if (minD >= minDist * 0.9) {
        if (!best || minD > best.score) best = { cx, cy, score: minD }
      }
    }
  }
  if (best) {
    const j = (salt * 2654435761) >>> 0
    const jx = ((j % 11) - 5) * 0.55
    const jy = (((j >> 8) % 11) - 5) * 0.55
    return {
      cx: clamp(best.cx + jx, margin, width - margin),
      cy: clamp(best.cy + jy, margin, height - margin),
    }
  }
  return {
    cx: clamp(margin + (cw * 0.35 + ((salt * 41) % 130) * 0.1), margin, width - margin),
    cy: clamp(margin + (ch * 0.42 + ((salt * 67) % 130) * 0.1), margin, height - margin),
  }
}

/** 기존 앵커들과 minDist 이상 떨어진 위치에 count개 — 앵커 배열에 순차 추가 */
function placeDropsAvoidingAnchors(
  width: number,
  height: number,
  count: number,
  initialAnchors: { cx: number; cy: number }[],
  margin: number,
  minDist: number,
): { cx: number; cy: number }[] {
  const anchors = initialAnchors.map((p) => ({ cx: p.cx, cy: p.cy }))
  const out: { cx: number; cy: number }[] = []
  const maxAttempts = 240
  for (let i = 0; i < count; i++) {
    let placed: { cx: number; cy: number } | null = null
    for (let k = 0; k < maxAttempts; k++) {
      const cx = margin + Math.random() * (width - 2 * margin)
      const cy = margin + Math.random() * (height - 2 * margin)
      let ok = true
      for (const p of anchors) {
        if (Math.hypot(cx - p.cx, cy - p.cy) < minDist) {
          ok = false
          break
        }
      }
      if (ok) {
        placed = { cx, cy }
        break
      }
    }
    if (!placed) {
      placed = fallbackPositionAvoiding(
        width,
        height,
        margin,
        minDist,
        anchors,
        out.length * 17 + i * 31 + anchors.length * 3,
      )
    }
    anchors.push(placed)
    out.push(placed)
  }
  return out
}

/** 개수만 바뀔 때: 늘리면 기존 방울 위치·목표 유지, 새 방울만 빈 곳에 추가 */
export function resizeDropSimulation(width: number, height: number, previousCount: number) {
  simReady = true

  const margin = 44
  dropRadiusPx = computeDropRadiusPx(height)
  selectedDropIndex = Math.min(selectedDropIndex, dropCount - 1)
  selectionHighlightActive = false

  const n = dropCount
  const minGap = Math.max(dropRadiusPx * 2.75, 80)
  const prev = clamp(Math.floor(previousCount), MIN_DROP_COUNT, MAX_DROPS)

  const clampDropIntoCanvas = (d: DropState) => {
    d.cx = clamp(d.cx, margin, width - margin)
    d.cy = clamp(d.cy, margin, height - margin)
    d.targetX = clamp(d.targetX, margin, width - margin)
    d.targetY = clamp(d.targetY, margin, height - margin)
  }

  if (n > prev) {
    const anchors: { cx: number; cy: number }[] = []
    for (let i = 0; i < prev; i++) {
      anchors.push({ cx: drops[i].cx, cy: drops[i].cy })
    }
    const newPos = placeDropsAvoidingAnchors(
      width,
      height,
      n - prev,
      anchors,
      margin,
      minGap,
    )
    for (let i = 0; i < prev; i++) clampDropIntoCanvas(drops[i])
    for (let j = 0; j < newPos.length; j++) {
      const i = prev + j
      const d = drops[i]
      const p = newPos[j]
      d.cvx = 0
      d.cvy = 0
      d.cx = p.cx
      d.cy = p.cy
      d.targetX = p.cx
      d.targetY = p.cy
      d.stretchSmooth = 1
      d.pinchSmooth = 0
      d.rippleSmooth = 0
      d.dirSmX = 1
      d.dirSmY = 0
      d.ripplePhaseAccum = 0
    }
  } else if (n < prev) {
    for (let i = 0; i < n; i++) clampDropIntoCanvas(drops[i])
  } else {
    for (let i = 0; i < n; i++) clampDropIntoCanvas(drops[i])
  }
}

export function resetSimulation(width: number, height: number) {
  simReady = true

  const margin = 44
  dropRadiusPx = computeDropRadiusPx(height)
  selectedDropIndex = Math.min(selectedDropIndex, dropCount - 1)
  selectionHighlightActive = false

  const n = dropCount
  const minGap = Math.max(dropRadiusPx * 2.75, 80)
  const positions = scatterDrops(width, height, n, margin, minGap)

  for (let i = 0; i < MAX_DROPS; i++) {
    const d = drops[i]
    d.cvx = 0
    d.cvy = 0
    d.stretchSmooth = 1
    d.pinchSmooth = 0
    d.rippleSmooth = 0
    d.dirSmX = 1
    d.dirSmY = 0
    d.ripplePhaseAccum = 0
    if (i < n) {
      const p = positions[i]
      d.cx = p.cx
      d.cy = p.cy
      d.targetX = p.cx
      d.targetY = p.cy
    }
  }
}

function integrateCenter(dt: number, width: number, height: number, idx: number) {
  const margin = 44
  const d = drops[idx]

  let ax = (d.targetX - d.cx) * K_PULL
  let ay = (d.targetY - d.cy) * K_PULL
  const al = Math.hypot(ax, ay)
  if (al > ACCEL_MAX) {
    ax *= ACCEL_MAX / al
    ay *= ACCEL_MAX / al
  }
  d.cvx += ax * dt
  d.cvy += ay * dt
  d.cvx *= Math.exp(-DRAG_ACTIVE * dt)
  d.cvy *= Math.exp(-DRAG_ACTIVE * dt)
  const sp = Math.hypot(d.cvx, d.cvy)
  if (sp > V_MAX) {
    const s = V_MAX / sp
    d.cvx *= s
    d.cvy *= s
  }

  d.cx += d.cvx * dt
  d.cy += d.cvy * dt
  d.cx = clamp(d.cx, margin, width - margin)
  d.cy = clamp(d.cy, margin, height - margin)
}

let acc = 0
const FIXED = 1 / 120

export function stepSimulation(
  width: number,
  height: number,
  dtSec: number,
  _wallTimeSec: number,
) {
  if (!simReady) resetSimulation(width, height)

  acc += dtSec
  let guard = 0
  while (acc >= FIXED && guard < 20) {
    for (let i = 0; i < dropCount; i++) {
      integrateCenter(FIXED, width, height, i)
    }
    acc -= FIXED
    guard++
  }
}

export function toGlY(yDom: number, height: number) {
  return height - yDom
}

export type DropUniformBatch = {
  count: number
  centerX: Float32Array
  centerYGl: Float32Array
  radiusX: Float32Array
  radiusY: Float32Array
  cosA: Float32Array
  sinA: Float32Array
  zScale: Float32Array
  ior: Float32Array
  speedPx: Float32Array
  wetStampAx: Float32Array
  wetStampBy: Float32Array
  tailPinch: Float32Array
  headBulge: Float32Array
  rearRipple: Float32Array
  ripplePhase: Float32Array
}

function fillUniformsForDrop(
  d: DropState,
  height: number,
  timeSec: number,
  dt: number,
  dropIndex: number,
  out: {
    centerX: number
    centerYGl: number
    radiusX: number
    radiusY: number
    cosA: number
    sinA: number
    zScale: number
    ior: number
    speedPx: number
    wetStampAx: number
    wetStampBy: number
    tailPinch: number
    headBulge: number
    rearRipple: number
    ripplePhase: number
  },
) {
  const speed = Math.hypot(d.cvx, d.cvy)
  const gdx = d.targetX - d.cx
  const gdyDom = d.targetY - d.cy
  const distG = Math.hypot(gdx, gdyDom)

  const urg = Math.min(2.2, distG / Math.max(48, dropRadiusPx * 2.8))
  const stretchFromDist = Math.min(0.38, urg * 0.19)
  const stretchFromSpeed = Math.min(0.2, speed * 0.000084)
  const alive = smoothstep(0, 26, distG + speed * 0.42)
  let stretchRaw = 1 + (stretchFromDist + stretchFromSpeed) * alive
  stretchRaw = Math.min(stretchRaw, 1.45)

  const angToT = angleToTarget(gdx, d.cy, d.targetY)
  let vx = d.cvx
  let vy = d.cvy
  const vlen = Math.hypot(vx, vy)
  if (vlen > 1e-4) {
    vx /= vlen
    vy /= vlen
  } else {
    vx = Math.cos(angToT)
    vy = Math.sin(angToT)
  }
  const angVel = Math.atan2(-vy, vx)

  const wMove = smoothstep(1.0, 38, speed)
  const wNear = 1 - smoothstep(6, 58, distG)
  const blendAng = clamp(wMove * (0.28 + 0.72 * wNear), 0, 1)

  let bx = Math.cos(angToT)
  let by = Math.sin(angToT)
  const ax = Math.cos(angVel)
  const ay = Math.sin(angVel)
  let tx = bx * (1 - blendAng) + ax * blendAng
  let ty = by * (1 - blendAng) + ay * blendAng
  if (distG < 5 && speed < 9) {
    tx = d.dirSmX
    ty = d.dirSmY
  }
  const th = Math.hypot(tx, ty)
  if (th > 1e-5) {
    tx /= th
    ty /= th
  }
  const ang = Math.atan2(ty, tx)

  d.stretchSmooth = expApproach(d.stretchSmooth, stretchRaw, dt, 0.034, 0.28)

  const cT = Math.cos(ang)
  const sT = Math.sin(ang)
  const tauAng =
    speed > 22 ? 0.036 : speed > 9 ? 0.085 : speed > 3 ? 0.16 : 0.32
  d.dirSmX += (cT - d.dirSmX) * (1 - Math.exp(-dt / tauAng))
  d.dirSmY += (sT - d.dirSmY) * (1 - Math.exp(-dt / tauAng))
  const nrm = Math.hypot(d.dirSmX, d.dirSmY)
  if (nrm > 1e-5) {
    d.dirSmX /= nrm
    d.dirSmY /= nrm
  }
  const angS = Math.atan2(d.dirSmY, d.dirSmX)

  const cosA = Math.cos(-angS)
  const sinA = Math.sin(-angS)
  const rx = dropRadiusPx * d.stretchSmooth
  const ry = dropRadiusPx / Math.sqrt(d.stretchSmooth)
  const mn = Math.min(rx, ry)

  const weLike = (speed * speed * dropRadiusPx) / 2.8e6
  const stretchExcess = Math.max(0, stretchRaw - 1)
  const speedGate = smoothstep(0, 48, speed)
  let rawTail = (stretchExcess * 0.52 + weLike * 1.45) * speedGate
  rawTail *= smoothstep(0, 22, distG + speed * 0.5)
  rawTail *= smoothstep(10, 42, speed)
  rawTail = clamp(rawTail, 0, 0.36)
  d.pinchSmooth = expApproach(d.pinchSmooth, rawTail, dt, 0.038, 0.29)

  const rippleSpeedGate =
    smoothstep(18, 46, speed) * smoothstep(0.015, 0.055, d.pinchSmooth)
  const rawRipple = clamp(
    rawTail * 0.38 * (1 - Math.exp(-speed / 108)) * smoothstep(5, 36, speed) * rippleSpeedGate,
    0,
    0.065,
  )
  d.rippleSmooth = expApproach(d.rippleSmooth, rawRipple, dt, 0.042, 0.22)

  const tailPinch = d.pinchSmooth
  const headBulge = tailPinch * 0.34
  const rearRipple = d.rippleSmooth
  const phaseRate = 6.2 + tailPinch * 5.5
  const phaseDrive =
    smoothstep(14, 40, speed) * smoothstep(0.012, 0.05, d.rippleSmooth)
  d.ripplePhaseAccum += dt * phaseRate * phaseDrive
  const ripplePhase = d.ripplePhaseAccum

  const wetAx = Math.max(rx * 0.9, mn * 0.62)
  const wetBy = Math.max(ry * 0.88, mn * 0.64)

  const { jx, jy } = idleWindJitterPx(timeSec, dropIndex, speed, distG)
  out.centerX = d.cx + jx
  out.centerYGl = toGlY(d.cy + jy, height)
  out.radiusX = rx
  out.radiusY = ry
  out.cosA = cosA
  out.sinA = sinA
  out.zScale = mn * 0.58
  out.ior = 1.333
  out.speedPx = speed
  out.wetStampAx = wetAx
  out.wetStampBy = wetBy
  out.tailPinch = tailPinch
  out.headBulge = headBulge
  out.rearRipple = rearRipple
  out.ripplePhase = ripplePhase
}

const scratch = {
  centerX: 0,
  centerYGl: 0,
  radiusX: 0,
  radiusY: 0,
  cosA: 0,
  sinA: 0,
  zScale: 0,
  ior: 0,
  speedPx: 0,
  wetStampAx: 0,
  wetStampBy: 0,
  tailPinch: 0,
  headBulge: 0,
  rearRipple: 0,
  ripplePhase: 0,
}

export function getDropUniformBatch(
  height: number,
  timeSec = 0,
  dtSec?: number,
): DropUniformBatch {
  const dt = dtSec != null && dtSec > 0 ? Math.min(dtSec, 0.08) : 1 / 60

  const batch: DropUniformBatch = {
    count: dropCount,
    centerX: new Float32Array(MAX_DROPS),
    centerYGl: new Float32Array(MAX_DROPS),
    radiusX: new Float32Array(MAX_DROPS),
    radiusY: new Float32Array(MAX_DROPS),
    cosA: new Float32Array(MAX_DROPS),
    sinA: new Float32Array(MAX_DROPS),
    zScale: new Float32Array(MAX_DROPS),
    ior: new Float32Array(MAX_DROPS),
    speedPx: new Float32Array(MAX_DROPS),
    wetStampAx: new Float32Array(MAX_DROPS),
    wetStampBy: new Float32Array(MAX_DROPS),
    tailPinch: new Float32Array(MAX_DROPS),
    headBulge: new Float32Array(MAX_DROPS),
    rearRipple: new Float32Array(MAX_DROPS),
    ripplePhase: new Float32Array(MAX_DROPS),
  }

  for (let i = 0; i < dropCount; i++) {
    fillUniformsForDrop(drops[i], height, timeSec, dt, i, scratch)
    batch.centerX[i] = scratch.centerX
    batch.centerYGl[i] = scratch.centerYGl
    batch.radiusX[i] = scratch.radiusX
    batch.radiusY[i] = scratch.radiusY
    batch.cosA[i] = scratch.cosA
    batch.sinA[i] = scratch.sinA
    batch.zScale[i] = scratch.zScale
    batch.ior[i] = scratch.ior
    batch.speedPx[i] = scratch.speedPx
    batch.wetStampAx[i] = scratch.wetStampAx
    batch.wetStampBy[i] = scratch.wetStampBy
    batch.tailPinch[i] = scratch.tailPinch
    batch.headBulge[i] = scratch.headBulge
    batch.rearRipple[i] = scratch.rearRipple
    batch.ripplePhase[i] = scratch.ripplePhase
  }

  return batch
}

/** @deprecated 단일 방울 API — 배치 첫 번째와 동일 */
export function getDropUniforms(height: number, timeSec = 0, dtSec?: number) {
  const b = getDropUniformBatch(height, timeSec, dtSec)
  const i = 0
  return {
    centerX: b.centerX[i],
    centerYGl: b.centerYGl[i],
    radiusX: b.radiusX[i],
    radiusY: b.radiusY[i],
    cosA: b.cosA[i],
    sinA: b.sinA[i],
    zScale: b.zScale[i],
    ior: b.ior[i],
    speedPx: b.speedPx[i],
    wetStampAx: b.wetStampAx[i],
    wetStampBy: b.wetStampBy[i],
    tailPinch: b.tailPinch[i],
    headBulge: b.headBulge[i],
    rearRipple: b.rearRipple[i],
    ripplePhase: b.ripplePhase[i],
  }
}

export function ensureSimulation(width: number, height: number) {
  if (!simReady) resetSimulation(width, height)
}
