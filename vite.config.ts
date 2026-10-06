import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { assistantApi } from './server/assistant-api';
import { importsApi } from './server/imports';
import { suggestionsApi } from './server/suggestions-api';
import { tagsApi } from './server/tags-api';
import { feedbackApi } from './server/feedback-api';
import { enrichmentApi } from './server/enrichment-api';
import { followUpsApi } from './server/follow-ups-api';
import { realtimeApi } from './server/realtime-api';

export default defineConfig({
  plugins: [react(), importsApi(), feedbackApi(), tagsApi(), suggestionsApi(), assistantApi(), realtimeApi(), enrichmentApi(), followUpsApi()],
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
