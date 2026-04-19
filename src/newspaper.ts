import {
  layoutNextLineRange,
  materializeLineRange,
  prepareWithSegments,
  type LayoutCursor,
} from '@chenglou/pretext'

/**
 * 편집기·localStorage 기본값 — 줄바꿈 포함(표시용).
 * 렌더 시 공백·줄바꿈은 제거해 세로 단행 본문으로 씀.
 */
export const DEFAULT_BACKGROUND_TEXT = `
朝鮮日報 大韓民國 京城府 昭和丙寅年 四月十九日 水曜日
國民의 氣運이 高揚하야 新時代를 迎하나니 萬民이 歡呼하도다
京城 鐘路區 明洞 通商이 繁盛하야 行路人 雜沓하니
東洋平和의 礎石을 築는 偉業이 進行중이로다
學校에서는 漢文과 國語를 竝行하야 敎育이 刷新되나
農村에서는 米穀의 收穫이 豊かにして 倉廩이 充實하도다
商工界에서는 織物·陶器·漆器의 輸出이 增加하야
外貨가 流入하니 國庫의 財源이 裕如하도다
鐵道·郵便·電信의 設備가 擴張되야 交通이 便易하도다
病院에서는 新醫術이 行はれ 患者의 苦痛이 輕減되나
警察에서는 治安維持에 勵み 夜間巡邏이 嚴重하도다
法院에서는 公義를 明斷하야 訴訟이 遲滯없이 結審되나
軍隊에서는 訓練이 精勵되야 國防이 鞏固하도다
婦人들은 家庭을 整理하야 子女를 敎育하니 家風이 淳厚하도다
少年들은 學堂에 集まり 經書를 讀으며 志操를 養成하도다
僧侶들은 寺院에서 經典을 諷誦하야 衆生을 濟度하도다
商人들은 市肆에 列貨를 陳하야 顧客을 待ち 居る
工人들은 工場에서 器械를 操り 製品을 出す
農夫들은 田野에 出で 犂를 引き 種子를 播く
漁夫들은 海洋に 乘り 網を 投じ 魚介を 獲る
詩人은 風月을 吟じ 文章을 綴り 士流의 雅懷을 表す
畵家は 山水を 描き 筆墨に 意趣を 傳ふ
樂人は 絃管을 調べ 宮商을 諧じ 聽衆을 娛す
劇人は 舞臺에 上り 忠義을 演じ 觀客을 感動시키도다
書生들은 燈下에 坐하야 史書를 披閱하니 古今을 通覽하도다
閨秀들은 刺繡에 精進하야 針線에 巧みにして 花鳥의 形을 肖す
老翁들은 桑下에 憩ひ 昔話を 語り 後進을 戒む
幼童들은 里巷에 戲び 童謠를 唱へ 天真을 露はす
春에는 桃李가 發花し 山川이 明媚하도다
夏에는 草木이 繁茂し 風雨이 時に 驟雨を 送る
秋에는 霜露이 下り 楓葉이 丹染み 鴻雁이 南征す
冬에는 冰雪이 嚴し 松竹이 後凋の 節을 保つ
天地의 運行이 循環하야 四時가 推移하니 萬物이 化育되도다
聖人の 敎へは 孝弟忠信 禮義廉恥 八德을 重んじ
君子는 修身齊家治國平天下의 道를 志す
小人은 利欲에 溺れ 義理를 忘れ 終に 禍을 招く
忠臣은 君을 諫め 奸臣은 國을 傾く
孝子는 親을 奉じ 逆子는 門楣를 汚す
烈女는 節操을 守り 蕩婦는 風紀를 亂す
`.trim()

const NEWSPAPER_BODY = DEFAULT_BACKGROUND_TEXT.replace(/\s+/g, '')

export const DEFAULT_FONT_SIZE_PX = 15
export const MIN_FONT_SIZE_PX = 11
/** 신문 텍스처(1200×1500) 안에서도 쓸 수 있을 만큼 크게 — 슬라이더·휠 상한 */
export const MAX_FONT_SIZE_PX = 120

export function clampFontSizePx(n: number): number {
  return Math.max(
    MIN_FONT_SIZE_PX,
    Math.min(MAX_FONT_SIZE_PX, Math.round(n)),
  )
}

function makeFontCss(sizePx: number): string {
  return `500 ${sizePx}px "Noto Serif KR", serif`
}

function hash01(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263
  n = (n ^ (n >>> 13)) * 1274126177
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function makeNoiseCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const nctx = c.getContext('2d')!
  const img = nctx.createImageData(size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const v = 20 + (Math.random() * 235) | 0
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 40 + (Math.random() * 80) | 0
  }
  nctx.putImageData(img, 0, 0)
  return c
}

function normalizeBody(raw: string): string {
  const t = raw.replace(/\s+/g, '')
  return t.length > 0 ? t : NEWSPAPER_BODY
}

export function renderNewspaperTexture(
  width: number,
  height: number,
  /** 비우면 기본 신문 본문 — 같은 노이즈·지면·단행 레이아웃·글자 농도 효과 유지 */
  bodyText?: string,
  fontSizePx: number = DEFAULT_FONT_SIZE_PX,
): HTMLCanvasElement {
  const fontPx = clampFontSizePx(fontSizePx)
  const fontCss = makeFontCss(fontPx)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true

  const base = ctx.createLinearGradient(0, 0, width, height)
  base.addColorStop(0, '#d4c4a8')
  base.addColorStop(0.45, '#c9b896')
  base.addColorStop(1, '#b8a682')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, width, height)

  const noise = makeNoiseCanvas(128)
  ctx.save()
  ctx.globalAlpha = 0.22
  const pattern = ctx.createPattern(noise, 'repeat')!
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width, height)
  ctx.restore()

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * width
    const y = Math.random() * height
    const r = 20 + Math.random() * 80
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(120,90,50,0.08)')
    g.addColorStop(1, 'rgba(120,90,50,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  ctx.font = fontCss
  ctx.textBaseline = 'top'

  const charW = Math.max(12, ctx.measureText('國').width) + fontPx * 0.09
  const lineHeight = Math.max(14, Math.round(fontPx * 1.27))
  const margin = 24
  const colGap = 10

  const body = normalizeBody(bodyText ?? '')
  const prepared = prepareWithSegments(body.repeat(60), fontCss, {
    wordBreak: 'keep-all',
  })

  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  let x = margin
  let y = margin

  outer: while (x + charW < width - margin) {
    y = margin
    while (y + lineHeight < height - margin) {
      const range = layoutNextLineRange(prepared, cursor, charW + 0.25)
      if (range === null) break outer
      const line = materializeLineRange(prepared, range)
      const col = Math.floor((x - margin) / (charW + colGap))
      const row = Math.floor((y - margin) / lineHeight)
      const a = 0.14 + hash01(col, row) * 0.38
      ctx.fillStyle = `rgba(35,32,28,${a.toFixed(3)})`
      ctx.fillText(line.text, x, y)
      cursor = range.end
      y += lineHeight
    }
    x += charW + colGap
  }

  return canvas
}
