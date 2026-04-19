/**
 * Ping-pong FBO로 신문 위 ‘젖은 자국’ 누적 + 프레임당 감쇠.
 * 물방울 중심이 지나간 곳에 부드러운 스탬프.
 */

export class WetTrail {
  private gl: WebGLRenderingContext
  private w = 0
  private h = 0
  private tex: [WebGLTexture, WebGLTexture] = [null!, null!]
  private fbo: [WebGLFramebuffer, WebGLFramebuffer] = [null!, null!]
  private prog: WebGLProgram
  private buf: WebGLBuffer
  private loc: number
  private uLocPrev: WebGLUniformLocation | null = null
  private uRes: WebGLUniformLocation | null = null
  private uDrop: WebGLUniformLocation | null = null
  private uDecay: WebGLUniformLocation | null = null
  private uStampAB: WebGLUniformLocation | null = null
  private uOrientCos: WebGLUniformLocation | null = null
  private uOrientSin: WebGLUniformLocation | null = null
  private uStampGain: WebGLUniformLocation | null = null
  /** 0 = 다음 스텝에서 tex[1]에 쓰고 tex[0] 읽기 */
  private ping = 0

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl
    const vert = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`
    const frag = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_prev;
uniform vec2 u_resolution;
uniform vec2 u_drop;
uniform float u_decay;
uniform vec2 u_stampAB;
uniform float u_orientCos;
uniform float u_orientSin;
uniform float u_stampGain;
void main() {
  float prev = texture2D(u_prev, v_uv).r;
  prev *= u_decay;
  vec2 fp = v_uv * u_resolution;
  vec2 rel = fp - u_drop;
  float lx = u_orientCos * rel.x - u_orientSin * rel.y;
  float ly = u_orientSin * rel.x + u_orientCos * rel.y;
  float de = length(vec2(lx / u_stampAB.x, ly / u_stampAB.y));
  /** 1.0 넘어가며 부드럽게 깎이면 가장자리가 넓어져 한 프레임당 ‘선’이 아니라 면이 쌓임 */
  float s = 1.0 - smoothstep(0.0, 1.22, de);
  float stamp = pow(max(s, 0.0), 1.35) * 0.48 * u_stampGain;
  float w = min(1.0, prev + stamp);
  gl_FragColor = vec4(w, w * 0.92, w * 0.85, 1.0);
}`
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, vert)
    gl.compileShader(vs)
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, frag)
    gl.compileShader(fs)
    this.prog = gl.createProgram()!
    gl.attachShader(this.prog, vs)
    gl.attachShader(this.prog, fs)
    gl.linkProgram(this.prog)
    if (!gl.getProgramParameter(this.prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(this.prog) || 'wet trail link')
    }
    this.loc = gl.getAttribLocation(this.prog, 'a_pos')
    this.uLocPrev = gl.getUniformLocation(this.prog, 'u_prev')
    this.uRes = gl.getUniformLocation(this.prog, 'u_resolution')
    this.uDrop = gl.getUniformLocation(this.prog, 'u_drop')
    this.uDecay = gl.getUniformLocation(this.prog, 'u_decay')
    this.uStampAB = gl.getUniformLocation(this.prog, 'u_stampAB')
    this.uOrientCos = gl.getUniformLocation(this.prog, 'u_orientCos')
    this.uOrientSin = gl.getUniformLocation(this.prog, 'u_orientSin')
    this.uStampGain = gl.getUniformLocation(this.prog, 'u_stampGain')

    this.buf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    )
  }

  resize(width: number, height: number) {
    const gl = this.gl
    if (this.w === width && this.h === height && this.tex[0]) return
    this.w = width
    this.h = height
    for (let i = 0; i < 2; i++) {
      if (this.tex[i]) gl.deleteTexture(this.tex[i])
      if (this.fbo[i]) gl.deleteFramebuffer(this.fbo[i])
      const t = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      )
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      this.tex[i] = t
      const fb = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        t,
        0,
      )
      this.fbo[i] = fb
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.clear()
  }

  clear() {
    const gl = this.gl
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo[i])
      gl.viewport(0, 0, this.w, this.h)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /**
   * 물방울과 같은 축 타원 스탬프 — stampAx/By 는 픽셀 반축, orient 는 메인 렌더와 동일
   */
  step(
    dropX: number,
    dropYGl: number,
    decay: number,
    stampAx: number,
    stampBy: number,
    orientCos: number,
    orientSin: number,
    stampGain = 1,
  ) {
    const gl = this.gl
    if (this.w < 2 || this.h < 2) return
    const readIdx = this.ping
    const writeIdx = 1 - this.ping
    const readTex = this.tex[readIdx]
    const writeFbo = this.fbo[writeIdx]

    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo)
    gl.viewport(0, 0, this.w, this.h)
    gl.useProgram(this.prog)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buf)
    gl.enableVertexAttribArray(this.loc)
    gl.vertexAttribPointer(this.loc, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, readTex)
    gl.uniform1i(this.uLocPrev, 0)
    gl.uniform2f(this.uRes!, this.w, this.h)
    gl.uniform2f(this.uDrop!, dropX, dropYGl)
    gl.uniform1f(this.uDecay!, decay)
    gl.uniform2f(
      this.uStampAB!,
      Math.max(12, stampAx),
      Math.max(11, stampBy),
    )
    gl.uniform1f(this.uOrientCos!, orientCos)
    gl.uniform1f(this.uOrientSin!, orientSin)
    gl.uniform1f(this.uStampGain!, stampGain)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    this.ping = writeIdx
  }

  /** 최근 스텝이 쓴 젖은 맵 (메인 셰이더에서 TEXTURE1) */
  getTexture(): WebGLTexture {
    return this.tex[this.ping]
  }
}
