import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// スマホ/トンネル動作確認用の設定:
//  - host: true         … LAN や cloudflared/ngrok から到達できるよう 0.0.0.0 で待受
//  - allowedHosts: true … trycloudflare.com / ngrok の動的サブドメインを許可
//  - proxy '/api'       … フロントと同一オリジンで backend(5001) に中継し CORS を回避
//                         （相対URLで叩けば Authorization: Bearer もそのまま通る）
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
