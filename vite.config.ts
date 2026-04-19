import { defineConfig } from 'vite'

/** GitHub Pages: 저장소 이름이 kimchang 이면 base는 `/kimchang/` (워크플로에서 VITE_BASE_PATH 설정) */
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  server: { open: true },
})
