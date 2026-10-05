import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { importsApi } from './server/imports';
import { tagsApi } from './server/tags-api';
import { feedbackApi } from './server/feedback-api';

export default defineConfig({
  plugins: [react(), importsApi(), feedbackApi(), tagsApi()],
  server:{proxy:{'/api/availability':{target:'http://127.0.0.1:8000',changeOrigin:true,headers:{origin:'http://127.0.0.1:8000'}},'/api/suggestions':{target:'http://127.0.0.1:8000',changeOrigin:true,headers:{origin:'http://127.0.0.1:8000'}},'/api/assistant':{target:'http://127.0.0.1:8000',changeOrigin:true,headers:{origin:'http://127.0.0.1:8000'}}}},
  preview:{proxy:{'/api/availability':{target:'http://127.0.0.1:8000',changeOrigin:true,headers:{origin:'http://127.0.0.1:8000'}},'/api/suggestions':{target:'http://127.0.0.1:8000',changeOrigin:true,headers:{origin:'http://127.0.0.1:8000'}},'/api/assistant':{target:'http://127.0.0.1:8000',changeOrigin:true,headers:{origin:'http://127.0.0.1:8000'}}}},
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
