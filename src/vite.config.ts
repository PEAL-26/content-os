import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import * as path from 'path';
import { defineConfig } from 'vite';
import { apiAiDevPlugin } from './server/vite-api-plugin';

// https://vite.dev/config/
export default defineConfig({
    server: {
        allowedHosts: ['.ngrok-free.app'],
    },
    plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] }),
        tailwindcss(),
        // /api/ai/* em dev — as LLMs correm server-side (Vercel Functions em
        // prod), resolvendo o CORS das chamadas diretas aos providers.
        apiAiDevPlugin(),
    ],
    build: {
        outDir: 'dist',
        // O maior chunk de rota (article-editor com @uiw/react-md-editor) é ~1.09 MB;
        // o SDK `ai` ~896 kB. Limite acima do maior chunk para refletir a realidade
        // do bundle da app.
        chunkSizeWarningLimit: 1200,
        rolldownOptions: {
            // O React Compiler (via @rolldown/plugin-babel) é uma transformação
            // intencionalmente pesada — desativar o diagnóstico de timings para não
            // poluir cada build com PLUGIN_TIMINGS.
            checks: {
                pluginTimings: false,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});