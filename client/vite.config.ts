import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv 读取 .env.development / .env.production 中的变量
  const env = loadEnv(mode, process.cwd(), '')
  const API_BASE = env.API_BASE_URL || 'http://localhost:8000'

  return {

  // base: './' 让 Capacitor 在移动端以相对路径加载资源（文件系统），本地 dev 调试时注释掉
  base: './',
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/ws': {
        target: API_BASE.replace(/^http/, 'ws'),
        ws: true,
      },
      '/companions': API_BASE,
      '/api': API_BASE,
      '/knowledge': API_BASE,
      // 与 normalizeMediaUrl() 将 localhost:8000 换成当前源一致：静态图必须打到后端，否则会 404/HTML 误判为图片 → onError 循环闪烁
      '/data': API_BASE,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui'
          if (id.includes('@radix-ui')) return 'vendor-radix'
          if (id.includes('recharts')) return 'vendor-charts'
          if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n'
          if (id.includes('react-router')) return 'vendor-router'
        },
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  }
})
