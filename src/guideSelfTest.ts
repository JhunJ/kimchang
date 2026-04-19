/**
 * 안내 문서 하단에서 브라우저·WebGL·입력 등 실행 환경을 점검합니다.
 */
export function attachGuideSelfTest(): void {
  const btn = document.getElementById('self-test-run')
  const out = document.getElementById('self-test-result')
  if (!btn || !out) return

  btn.addEventListener('click', () => {
    const rows: { pass: boolean; label: string }[] = []

    const canvas = document.querySelector(
      '#stage canvas',
    ) as HTMLCanvasElement | null
    rows.push({
      pass: !!canvas,
      label: '위쪽 캔버스가 생성되어 있음',
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
      label: 'WebGL 컨텍스트 획득 (물방울 렌더에 필요)',
    })

    try {
      const k = '__kimchang_ls_probe__'
      localStorage.setItem(k, '1')
      localStorage.removeItem(k)
      rows.push({
        pass: true,
        label: 'localStorage (본문·설정 저장)',
      })
    } catch {
      rows.push({
        pass: false,
        label: 'localStorage 사용 불가 (비공개 모드 등)',
      })
    }

    rows.push({
      pass: typeof PointerEvent !== 'undefined',
      label: 'Pointer Events (마우스·터치·펜)',
    })

    const ta = document.getElementById('bg-text')
    rows.push({
      pass: ta instanceof HTMLTextAreaElement,
      label: '신문 본문 편집 영역 존재',
    })

    const dc = document.getElementById('drop-count')
    rows.push({
      pass: dc instanceof HTMLInputElement && dc.type === 'range',
      label: '물방울 개수 슬라이더 존재',
    })

    const allPass = rows.every((r) => r.pass)
    const list = rows
      .map((r) => {
        const cls = r.pass ? 'self-test-ok' : 'self-test-fail'
        const mark = r.pass ? '통과' : '실패'
        return `<li class="${cls}"><span class="self-test-mark">${mark}</span> ${r.label}</li>`
      })
      .join('')

    out.innerHTML = `
      <p class="self-test-summary ${allPass ? 'self-test-ok' : 'self-test-fail'}">
        ${allPass ? '모든 항목이 통과했습니다. 아래에서 조작을 시험해 보세요.' : '일부 항목이 실패했습니다. 브라우저 설정이나 하드웨어 가속을 확인해 주세요.'}
      </p>
      <ul class="self-test-list">${list}</ul>
    `
  })
}
