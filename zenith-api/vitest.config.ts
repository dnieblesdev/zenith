import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@prisma/client': path.resolve(__dirname, 'node_modules/@prisma/client'),
    },
  },
})
