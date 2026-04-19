const MQ_MOBILE_TABS = '(max-width: 767px)'

function isMobileTabs(): boolean {
  return window.matchMedia(MQ_MOBILE_TABS).matches
}

function setActiveTab(index: 0 | 1 | 2) {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.option-tab')
  const panels = document.querySelectorAll<HTMLElement>('.option-panel')
  tabs.forEach((t, i) => {
    const on = i === index
    t.setAttribute('aria-selected', on ? 'true' : 'false')
    t.tabIndex = on ? 0 : -1
  })
  panels.forEach((p, i) => {
    p.classList.toggle('is-active', i === index)
  })
}

function syncPanelsForViewport() {
  const mobile = isMobileTabs()
  const panels = document.querySelectorAll<HTMLElement>('.option-panel')
  const tablist = document.getElementById('option-tablist')
  if (!mobile) {
    panels.forEach((p) => p.classList.add('is-active'))
    tablist?.setAttribute('aria-hidden', 'true')
  } else {
    tablist?.removeAttribute('aria-hidden')
    const tabs = document.querySelectorAll<HTMLButtonElement>('.option-tab')
    let sel = -1
    tabs.forEach((t, i) => {
      if (t.getAttribute('aria-selected') === 'true') sel = i
    })
    const idx = (sel >= 0 ? sel : 0) as 0 | 1 | 2
    setActiveTab(idx)
  }
}

import { syncCanvasOnlyButton } from './i18n'

const CANVAS_ONLY_KEY = 'kimchang-ui-canvas-only'

function readStoredCanvasOnly(): boolean {
  try {
    return localStorage.getItem(CANVAS_ONLY_KEY) === '1'
  } catch {
    return false
  }
}

function persistCanvasOnly(on: boolean) {
  try {
    localStorage.setItem(CANVAS_ONLY_KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function applyCanvasOnly(on: boolean) {
  document.body.classList.toggle('ui-canvas-only', on)
  const topBtn = document.getElementById('btn-canvas-only')
  if (topBtn) {
    topBtn.setAttribute('aria-pressed', on ? 'true' : 'false')
  }
  syncCanvasOnlyButton(on)
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event('resize'))
  })
}

/**
 * 모바일: 옵션 탭. PC/태블릿: 탭 숨김·패널 전부 표시.
 * 화면만 모드: 상단바·옵션·하단 가이드 숨기고 캔버스 위주, 스크롤 잠금.
 */
export function initUiChrome(onLayout: () => void): void {
  const tabs = document.querySelectorAll<HTMLButtonElement>('.option-tab')
  tabs.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      if (!isMobileTabs()) return
      setActiveTab(i as 0 | 1 | 2)
      // 탭만 바꿀 때는 캔버스 크기가 같으므로 resize를 쏘지 않음(물방울 위치 유지)
    })
  })

  syncPanelsForViewport()
  window.addEventListener('resize', () => {
    syncPanelsForViewport()
    onLayout()
  })

  const topBtn = document.getElementById('btn-canvas-only')

  const toggle = () => {
    const next = !document.body.classList.contains('ui-canvas-only')
    applyCanvasOnly(next)
    persistCanvasOnly(next)
    if (!next) {
      try {
        window.scrollTo({ top: 0, behavior: 'auto' })
      } catch {
        window.scrollTo(0, 0)
      }
    }
    onLayout()
  }

  topBtn?.addEventListener('click', toggle)

  if (readStoredCanvasOnly()) {
    applyCanvasOnly(true)
  } else {
    applyCanvasOnly(false)
  }
}
