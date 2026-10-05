import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { importsApi } from './server/imports';
import { suggestionsApi } from './server/suggestions-api';
import { tagsApi } from './server/tags-api';
import { feedbackApi } from './server/feedback-api';

export default defineConfig({
  plugins: [react(), importsApi(), feedbackApi(), tagsApi(), suggestionsApi()],
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
