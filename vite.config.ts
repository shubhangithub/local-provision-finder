import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { importsApi } from './server/imports';

export default defineConfig({
  plugins: [react(), importsApi()],
  test: { include: ['src/**/*.test.ts'] },
});
