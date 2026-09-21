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
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
