export type Lang = 'ko' | 'en'

const STORAGE_KEY = 'kimchang-lang'

export function getStoredLang(): Lang {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    if (s === 'en' || s === 'ko') return s
  } catch {
    /* ignore */
  }
  return 'ko'
}

export function setStoredLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
}

type Dict = Record<string, string>

const KO: Dict = {
  docTitle:
    '김창열 물방울 아트 — 신문·굴절 WebGL 인터랙션 | Kim Tschang-yeul homage',
  skip: '상세 안내로 건너뛰기',
  appTitle: '김창열 물방울 <span>· WebGL</span>',
  intro: '소개·사용법',
  langAria: '언어 선택',
  stageAria: '물방울이 신문 위에 올라간 WebGL 캔버스',
  bgEditorAria: '신문 본문 및 물방울 설정',
  labelBg: '신문 본문 (굴절·물방울에 반영)',
  phBg: '한글·한자 등 입력… 비우면 기본 신문 본문이 사용됩니다.',
  titleFontWheel: '슬라이더 조절 또는 이 영역에서 마우스 휠로 크기 변경',
  labelFont: '글자 크기',
  titleDropSize: '슬라이더 또는 이 줄에서 마우스 휠로 물방울 크기 조절 (100% = 기본)',
  labelDropSize: '물방울 크기',
  titleDropCount: '슬라이더 또는 이 줄에서 마우스 휠로 물방울 개수 (최대 64개)',
  labelDropCount: '물방울 개수',
  hint: '설정은 이 기기에 저장됩니다. 슬라이더 줄을 손가락으로 밀거나(모바일), PC에서는 휠로 미세 조정할 수 있습니다.',
  guideSummary: '상세 안내 · 김창열 · 사용법',
  expandClosed: '▼ 펼치기',
  expandOpen: '▲ 접기',
  guideAboutH: '요약',
  guideAboutHtml: `신문 질감 텍스트 위에 WebGL 물방울 굴절·젖은 자국을 보여 주는 비공식 데모입니다. 개수를 늘리면 <strong>기존 방울은 그대로</strong>, 빈 곳에만 추가됩니다.`,
  guideModesH: '조작',
  guideModesHtml: `<li><strong>방울 1개</strong>: 드래그 또는 탭으로 이동.</li><li><strong>여러 개</strong>: 방울 탭 → 선택 → 빈 곳 탭하면 그 방울만 이동. 같은 방울 다시 탭 → 선택 해제.</li>`,
  guideArtH: '김창열',
  guideArtHtml: `<strong>Kim Tschang-yeul</strong> 등으로 알려진 <strong>김창열</strong>(1929–2021) 작가의 물방울·신문 미학을 참고했을 뿐, 공식 작품·협력과는 무관합니다.`,
  guideLinksH: '링크',
  linkWikiKo: '위키 — 김창열 (화가)',
  linkWikiEn: 'Wikipedia — Kim Tschang-yeul',
  linkMuseum: '김창열 미술관 (제주)',
  linkGithub: '소스 GitHub',
  guideTestH: '실행 점검',
  selfTestBtn: 'WebGL·저장소 확인',
  selfPass: '통과',
  selfFail: '실패',
  selfAllOk:
    '모든 항목이 통과했습니다. 아래에서 조작을 시험해 보세요.',
  selfSomeFail:
    '일부 항목이 실패했습니다. 브라우저 설정이나 하드웨어 가속을 확인해 주세요.',
  stCanvas: '위쪽 캔버스가 생성되어 있음',
  stWebgl: 'WebGL 컨텍스트 획득 (물방울 렌더에 필요)',
  stLsOk: 'localStorage (본문·설정 저장)',
  stLsBad: 'localStorage 사용 불가 (비공개 모드 등)',
  stPointer: 'Pointer Events (마우스·터치·펜)',
  stTa: '신문 본문 편집 영역 존재',
  stDrop: '물방울 개수 슬라이더 존재',
  labelLightingTitle: '조명 · 유리 느낌',
  labelGlass: '유리(투명)',
  titleGlassRow: '낮을수록 배경이 더 비치는 유리 느낌',
  labelVfxShadow: '그림자·빛 번짐',
  titleVfxShadowRow: '브라운 그림자와 따뜻한 캐스틱 번짐',
  labelSat: '방울 안 채도',
  titleSatRow: '방울 안 글자 채도 (맑은 느낌)',
  labelSunElev: '빛 높이 · 그림자',
  titleSunElevRow:
    '낮을수록 빛이 스쳐 지나가 조명 반대 방향으로 그림자가 길게 늘어나고, 높을수록 짧아집니다 (원처럼 커지는 느낌이 아님)',
  tabText: '본문',
  tabDrops: '방울',
  tabLight: '조명',
  ariaTablist: '옵션 탭',
  btnCanvasOnly: '화면만',
  titleCanvasOnly: '패널·안내를 숨기고 캔버스만 표시',
  btnShowOptions: '옵션 보이기',
  titleShowOptions: '설정 패널 다시 표시',
}

const EN: Dict = {
  docTitle:
    'Kim Tschang-yeul — Water drops on newsprint (WebGL) | Interactive homage',
  skip: 'Skip to details',
  appTitle: 'Kim Tschang-yeul <span>· WebGL</span>',
  intro: 'About · How to use',
  langAria: 'Language',
  stageAria: 'WebGL canvas: water droplets on newspaper texture',
  bgEditorAria: 'Newspaper text and droplet settings',
  labelBg: 'Newspaper text (refracted in droplets)',
  phBg: 'Type Hangul, Hanja, etc. Leave empty for default sample text.',
  titleFontWheel: 'Drag slider or use mouse wheel on this row to change size',
  labelFont: 'Font size',
  titleDropSize: 'Slider or wheel: droplet size (100% = default)',
  labelDropSize: 'Droplet size',
  titleDropCount: 'Slider or wheel: number of droplets (max 64)',
  labelDropCount: 'Droplet count',
  hint: 'Settings are saved on this device. On mobile, drag sliders; on desktop you can also use the wheel.',
  guideSummary: 'Details · Kim Tschang-yeul · Usage',
  expandClosed: '▼ Expand',
  expandOpen: '▲ Collapse',
  guideAboutH: 'Summary',
  guideAboutHtml: `Unofficial demo: WebGL droplets with refraction and wet trails on newsprint-like text. Adding droplets keeps <strong>existing ones in place</strong> and fills empty space only.`,
  guideModesH: 'Controls',
  guideModesHtml: `<li><strong>One droplet</strong>: drag or tap to move.</li><li><strong>Multiple</strong>: tap a droplet to select → tap empty space to move only that one. Tap the same droplet again to clear selection.</li>`,
  guideArtH: 'About the artist',
  guideArtHtml: `Inspired by the water-on-newsprint aesthetic of <strong>Kim Tschang-yeul</strong> (1929–2021; Hangul: 김창열). Not an official work or partnership.`,
  guideLinksH: 'Links',
  linkWikiKo: 'Korean Wikipedia — 김창열 (Kim Tschang-yeul)',
  linkWikiEn: 'English Wikipedia — Kim Tschang-yeul',
  linkMuseum: 'Kim Tschang-yeul Art Museum (Jeju)',
  linkGithub: 'Source on GitHub',
  guideTestH: 'Environment check',
  selfTestBtn: 'Check WebGL & storage',
  selfPass: 'OK',
  selfFail: 'Fail',
  selfAllOk: 'All checks passed. Try the canvas and sliders below.',
  selfSomeFail:
    'Some checks failed. Try enabling hardware acceleration or another browser.',
  stCanvas: 'Canvas element present',
  stWebgl: 'WebGL context (required for droplet rendering)',
  stLsOk: 'localStorage (saves text & settings)',
  stLsBad: 'localStorage unavailable (e.g. private mode)',
  stPointer: 'Pointer events (mouse, touch, pen)',
  stTa: 'Newspaper text area present',
  stDrop: 'Droplet count slider present',
  labelLightingTitle: 'Lighting · glass look',
  labelGlass: 'Glass (transparency)',
  titleGlassRow: 'Lower = more see-through, glassier',
  labelVfxShadow: 'Shadow & caustic glow',
  titleVfxShadowRow: 'Warm brown shadow and amber caustic under drops',
  labelSat: 'Saturation inside drop',
  titleSatRow: 'Text saturation inside the droplet (clearer look)',
  labelSunElev: 'Sun height · shadow',
  titleSunElevRow:
    'Lower sun: shadow stretches along the light direction (elongated), not a uniform radial bloom. Higher: shorter.',
  tabText: 'Text',
  tabDrops: 'Drops',
  tabLight: 'Light',
  ariaTablist: 'Option tabs',
  btnCanvasOnly: 'Canvas only',
  titleCanvasOnly: 'Hide panels and guide; show canvas only',
  btnShowOptions: 'Show options',
  titleShowOptions: 'Show settings panel again',
}

const DICTS: Record<Lang, Dict> = { ko: KO, en: EN }

let currentLang: Lang = 'ko'

export function getCurrentLang(): Lang {
  return currentLang
}

export function t(lang: Lang, key: keyof typeof KO): string {
  return DICTS[lang][key] ?? KO[key] ?? String(key)
}

/** 슬라이더 옆 물방울 개수 표시 */
export function formatDropCountVal(lang: Lang, n: number): string {
  return lang === 'en' ? String(n) : `${n}개`
}

export function getLangDict(lang: Lang): Dict {
  return DICTS[lang]
}

/** 화면만 모드일 때는 같은 버튼을 「옵션 보이기」로 표시 */
export function syncCanvasOnlyButton(isCanvasOnly: boolean): void {
  const btn = document.getElementById('btn-canvas-only')
  if (!btn) return
  const d = DICTS[currentLang]
  if (isCanvasOnly) {
    btn.textContent = d.btnShowOptions
    btn.setAttribute('title', d.titleShowOptions)
  } else {
    btn.textContent = d.btnCanvasOnly
    btn.setAttribute('title', d.titleCanvasOnly)
  }
}

export function applyPageLanguage(lang: Lang): void {
  currentLang = lang
  document.documentElement.lang = lang === 'en' ? 'en' : 'ko'
  const d = DICTS[lang]

  document.title = d.docTitle

  const setText = (id: string, key: keyof typeof KO) => {
    const el = document.getElementById(id)
    if (el) el.textContent = d[key]
  }
  const setHtml = (id: string, key: keyof typeof KO) => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = d[key]
  }
  const setAttr = (sel: string, attr: string, key: keyof typeof KO) => {
    const el = document.querySelector(sel)
    if (el) el.setAttribute(attr, d[key])
  }

  const skip = document.querySelector('.skip-link')
  if (skip) skip.textContent = d.skip

  setHtml('i18n-app-title', 'appTitle')
  setText('i18n-intro', 'intro')
  setAttr('#stage', 'aria-label', 'stageAria')
  setAttr('.bg-editor', 'aria-label', 'bgEditorAria')

  const labelBg = document.querySelector('label[for="bg-text"]')
  if (labelBg) labelBg.textContent = d.labelBg

  const ta = document.getElementById('bg-text') as HTMLTextAreaElement | null
  if (ta) ta.placeholder = d.phBg

  const fontRow = document.getElementById('bg-font-row')
  if (fontRow) fontRow.setAttribute('title', d.titleFontWheel)

  const lf = document.querySelector('label[for="bg-font-size"]')
  if (lf) lf.textContent = d.labelFont

  const dsRow = document.getElementById('drop-size-row')
  if (dsRow) dsRow.setAttribute('title', d.titleDropSize)
  const lds = document.querySelector('label[for="drop-size"]')
  if (lds) lds.textContent = d.labelDropSize

  const dcRow = document.getElementById('drop-count-row')
  if (dcRow) dcRow.setAttribute('title', d.titleDropCount)
  const ldc = document.querySelector('label[for="drop-count"]')
  if (ldc) ldc.textContent = d.labelDropCount

  const lt = document.getElementById('i18n-label-lighting-title')
  if (lt) lt.textContent = d.labelLightingTitle
  const lg = document.getElementById('i18n-label-glass')
  if (lg) lg.textContent = d.labelGlass
  const lv = document.getElementById('i18n-label-vfx-shadow')
  if (lv) lv.textContent = d.labelVfxShadow
  const ls = document.getElementById('i18n-label-sat')
  if (ls) ls.textContent = d.labelSat
  const glassRow = document.getElementById('glass-row')
  if (glassRow) glassRow.setAttribute('title', d.titleGlassRow)
  const vfxRow = document.getElementById('vfx-shadow-row')
  if (vfxRow) vfxRow.setAttribute('title', d.titleVfxShadowRow)
  const satRow = document.getElementById('sat-row')
  if (satRow) satRow.setAttribute('title', d.titleSatRow)
  const sunElevLabel = document.getElementById('i18n-label-sun-elev')
  if (sunElevLabel) sunElevLabel.textContent = d.labelSunElev
  const sunElevRow = document.getElementById('sun-elev-row')
  if (sunElevRow) sunElevRow.setAttribute('title', d.titleSunElevRow)

  const hint = document.querySelector('.bg-editor .hint')
  if (hint) hint.textContent = d.hint

  const sumMain = document.getElementById('i18n-guide-summary-main')
  if (sumMain) sumMain.textContent = d.guideSummary
  const wc = document.querySelector('.when-closed')
  const wo = document.querySelector('.when-open')
  if (wc) wc.textContent = d.expandClosed
  if (wo) wo.textContent = d.expandOpen

  setText('i18n-guide-about-h', 'guideAboutH')
  setHtml('i18n-guide-about-p', 'guideAboutHtml')
  setText('i18n-guide-modes-h', 'guideModesH')
  const modesUl = document.getElementById('i18n-guide-modes-ul')
  if (modesUl) modesUl.innerHTML = d.guideModesHtml
  setText('i18n-guide-art-h', 'guideArtH')
  setHtml('i18n-guide-art-p', 'guideArtHtml')
  setText('i18n-guide-links-h', 'guideLinksH')

  const aWikiKo = document.getElementById('link-wiki-ko')
  if (aWikiKo) aWikiKo.textContent = d.linkWikiKo
  const aWikiEn = document.getElementById('link-wiki-en')
  if (aWikiEn) aWikiEn.textContent = d.linkWikiEn
  const aMus = document.getElementById('link-museum')
  if (aMus) aMus.textContent = d.linkMuseum
  const aGh = document.getElementById('link-github')
  if (aGh) aGh.textContent = d.linkGithub

  setText('i18n-guide-test-h', 'guideTestH')
  const stBtn = document.getElementById('self-test-run')
  if (stBtn) stBtn.textContent = d.selfTestBtn

  const guideArt = document.getElementById('guide')
  if (guideArt) guideArt.setAttribute('lang', lang === 'en' ? 'en' : 'ko')

  const koBtn = document.getElementById('lang-ko')
  const enBtn = document.getElementById('lang-en')
  if (koBtn) {
    koBtn.setAttribute('aria-pressed', lang === 'ko' ? 'true' : 'false')
  }
  if (enBtn) {
    enBtn.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false')
  }

  const langGroup = document.getElementById('lang-switch')
  if (langGroup) langGroup.setAttribute('aria-label', d.langAria)

  const tabText = document.getElementById('tab-text')
  const tabDrops = document.getElementById('tab-drops')
  const tabLight = document.getElementById('tab-light')
  if (tabText) tabText.textContent = d.tabText
  if (tabDrops) tabDrops.textContent = d.tabDrops
  if (tabLight) tabLight.textContent = d.tabLight
  const tablist = document.getElementById('option-tablist')
  if (tablist) tablist.setAttribute('aria-label', d.ariaTablist)

  syncCanvasOnlyButton(document.body.classList.contains('ui-canvas-only'))
}

export function initI18nUi(
  onChange: (lang: Lang) => void,
): void {
  const koBtn = document.getElementById('lang-ko')
  const enBtn = document.getElementById('lang-en')
  const set = (lang: Lang) => {
    setStoredLang(lang)
    applyPageLanguage(lang)
    onChange(lang)
  }
  koBtn?.addEventListener('click', () => set('ko'))
  enBtn?.addEventListener('click', () => set('en'))
}
