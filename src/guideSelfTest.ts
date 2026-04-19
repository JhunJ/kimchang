/**
 * 안내 문서 하단에서 브라우저·WebGL·입력 등 실행 환경을 점검합니다.
 */
import { getCurrentLang, t } from './i18n'

export function attachGuideSelfTest(): void {
  const btn = document.getElementById('self-test-run')
  const out = document.getElementById('self-test-result')
  if (!btn || !out) return

  btn.addEventListener('click', () => {
    const lang = getCurrentLang()
    const rows: { pass: boolean; label: string }[] = []

    const canvas = document.querySelector(
      '#stage canvas',
    ) as HTMLCanvasElement | null
    rows.push({
      pass: !!canvas,
      label: t(lang, 'stCanvas'),
    })

    let gl: WebGLRenderingContext | null = null
    if (canvas) {
      gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: true,
        failIfMajorPerformanceCaveat: false,
      })
    }
    rows.push({
      pass: !!gl,
      label: t(lang, 'stWebgl'),
    })

    let passLs = false
    try {
      const k = '__kimchang_ls_probe__'
      localStorage.setItem(k, '1')
      localStorage.removeItem(k)
      passLs = true
    } catch {
      passLs = false
    }
    rows.push({
      pass: passLs,
      label: passLs ? t(lang, 'stLsOk') : t(lang, 'stLsBad'),
    })

    rows.push({
      pass: typeof PointerEvent !== 'undefined',
      label: t(lang, 'stPointer'),
    })

    const ta = document.getElementById('bg-text')
    rows.push({
      pass: ta instanceof HTMLTextAreaElement,
      label: t(lang, 'stTa'),
    })

    const dc = document.getElementById('drop-count')
    rows.push({
      pass: dc instanceof HTMLInputElement && dc.type === 'range',
      label: t(lang, 'stDrop'),
    })

    const allPass = rows.every((r) => r.pass)
    const list = rows
      .map((r) => {
        const cls = r.pass ? 'self-test-ok' : 'self-test-fail'
        const mark = r.pass ? t(lang, 'selfPass') : t(lang, 'selfFail')
        return `<li class="${cls}"><span class="self-test-mark">${mark}</span> ${r.label}</li>`
      })
      .join('')

    const summary = allPass ? t(lang, 'selfAllOk') : t(lang, 'selfSomeFail')

    out.innerHTML = `
      <p class="self-test-summary ${allPass ? 'self-test-ok' : 'self-test-fail'}">
        ${summary}
      </p>
      <ul class="self-test-list">${list}</ul>
    `
  })
}
