import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import * as path from 'path';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
    server:{
        allowedHosts:[".ngrok-free.app"],
        proxy: {
            '/v1': {
                target: 'https://integrate.api.nvidia.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/v1/, '/v1'),
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            },
        },
    },
    plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] }),
        tailwindcss(),
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
