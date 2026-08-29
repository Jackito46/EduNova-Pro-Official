import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Plugin Vite pour injecter l'empreinte unique du déploiement Render dans le Service Worker.
 * Cela garantit une modification byte-to-byte du fichier sw.js lors de chaque build Render,
 * forçant le navigateur à détecter et installer immédiatement la nouvelle version du SW.
 */
function renderServiceWorkerHashPlugin(deployHash: string, buildTimestamp: string) {
  return {
    name: 'render-sw-hash-injection',
    closeBundle() {
      const swDistPath = path.resolve(__dirname, 'dist', 'sw.js');
      if (fs.existsSync(swDistPath)) {
        const originalContent = fs.readFileSync(swDistPath, 'utf-8');
        const header = `/**\n * EduNova Pro - Render Service Worker Cache Buster\n * Deployment Hash: ${deployHash}\n * Build Timestamp: ${buildTimestamp}\n */\n`;
        if (!originalContent.includes('Deployment Hash:')) {
          fs.writeFileSync(swDistPath, header + originalContent, 'utf-8');
          console.log(`✨ [Render PWA] Hash unique injecté dans dist/sw.js : ${deployHash}`);
        }
      }
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const buildTimestamp = new Date().toISOString();
    const renderGitCommit = process.env.RENDER_GIT_COMMIT || env.RENDER_GIT_COMMIT || '';
    const deployHash = renderGitCommit 
      ? `render-${renderGitCommit.substring(0, 10)}` 
      : `edunova-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const buildId = `edunova-${Date.now()}`;

    // Diagnostic d'environnement lors de la compilation
    console.log('\n====================================================');
    console.log(`🚀 [EduNova Build Diagnostic] Mode: ${mode}`);
    console.log(`⏱️  Timestamp de compilation: ${buildTimestamp}`);
    console.log(`🏷️  Empreinte de Build: ${buildId}`);
    console.log(`⚡ Hash Déploiement Render (SW): ${deployHash}`);
    console.log(`🌐 VITE_SUPABASE_URL: ${env.VITE_SUPABASE_URL ? `Détecté (${env.VITE_SUPABASE_URL})` : 'Utilisation du fallback configuré'}`);
    console.log(`🔑 VITE_SUPABASE_ANON_KEY: ${env.VITE_SUPABASE_ANON_KEY ? 'Détecté (Clé anonyme présente)' : 'Utilisation du fallback configuré'}`);
    console.log(`⚙️  Node Environment: ${process.env.NODE_ENV || mode}`);
    console.log('====================================================\n');
    
    return {
      define: {
        '__BUILD_TIMESTAMP__': JSON.stringify(buildTimestamp),
        '__BUILD_ID__': JSON.stringify(buildId),
        '__DEPLOY_HASH__': JSON.stringify(deployHash),
        '__RENDER_GIT_COMMIT__': JSON.stringify(renderGitCommit || 'Not on Render or local'),
        '__NODE_ENV__': JSON.stringify(process.env.NODE_ENV || mode),
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false
      },
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        chunkSizeWarningLimit: 2500,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-ui': ['lucide-react', 'framer-motion', 'sonner', 'clsx', 'tailwind-merge'],
              'vendor-charts': ['recharts'],
              'vendor-supabase': ['@supabase/supabase-js'],
              'vendor-pdf': ['jspdf', 'html2canvas', 'jspdf-autotable'],
              'vendor-xlsx': ['xlsx']
            }
          }
        }
      },
      plugins: [
        react(), 
        tailwindcss(),
        renderServiceWorkerHashPlugin(deployHash, buildTimestamp),
        VitePWA({
          strategies: 'injectManifest',
          srcDir: 'src',
          filename: 'sw.js',
          registerType: 'autoUpdate',
          injectRegister: 'inline',
          includeAssets: [
            'sw.js',
            'favicon.ico', 
            'favicon.png', 
            'logo.png',
            'apple-touch-icon.png',
            'pwa-72x72.png',
            'pwa-96x96.png',
            'pwa-128x128.png',
            'pwa-144x144.png',
            'pwa-152x152.png',
            'pwa-192x192.png', 
            'pwa-maskable-192x192.png',
            'pwa-256x256.png',
            'pwa-384x384.png',
            'pwa-512x512.png', 
            'pwa-maskable-512x512.png', 
            'screenshot-desktop.png', 
            'screenshot-mobile.png',
            'manifest.webmanifest',
            'manifest.json'
          ],
          manifest: {
            id: '/?source=pwa',
            name: 'EduNova Pro - Système de Gestion Scolaire',
            short_name: 'EduNova Pro',
            description: 'Système complet de Gestion Académique, Pédagogique et Financière pour Établissements Scolaires',
            theme_color: '#2563eb',
            background_color: '#0b132b',
            display: 'standalone',
            display_override: ['window-controls-overlay', 'standalone', 'minimal-ui', 'browser'],
            start_url: '/',
            scope: '/',
            orientation: 'any',
            lang: 'fr',
            dir: 'ltr',
            categories: ['education', 'productivity', 'business', 'finance'],
            prefer_related_applications: false,
            iarc_rating_id: 'e84b072d-71b3-4d3e-86ae-31a8ec4e53b7',
            handle_links: 'preferred',
            launch_handler: {
              client_mode: ['navigate-existing', 'auto']
            },
            edge_side_panel: {
              preferred_width: 480
            },
            scope_extensions: [
              { origin: 'https://edunova-9fgv.onrender.com' },
              { origin: 'https://edunova.pro' }
            ],
            related_applications: [
              {
                platform: 'windows',
                id: 'EduNovaPro.GestionScolaire',
                url: 'https://edunova-9fgv.onrender.com'
              },
              {
                platform: 'play',
                id: 'edu.edunova.pro',
                url: 'https://edunova-9fgv.onrender.com'
              },
              {
                platform: 'webapp',
                id: 'edu.edunova.pro',
                url: 'https://edunova-9fgv.onrender.com/manifest.webmanifest'
              }
            ],
            file_handlers: [
              {
                action: '/#/',
                name: 'Documents & Relevés Scolaires',
                icons: [
                  {
                    src: '/pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png'
                  }
                ],
                accept: {
                  'application/pdf': ['.pdf'],
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
                  'application/vnd.ms-excel': ['.xls'],
                  'text/csv': ['.csv'],
                  'application/json': ['.json']
                }
              }
            ],
            protocol_handlers: [
              {
                protocol: 'web+edunova',
                url: '/#/?action=%s'
              }
            ],
            share_target: {
              action: '/#/',
              method: 'GET',
              params: {
                title: 'title',
                text: 'text',
                url: 'url'
              }
            },
            shortcuts: [
              {
                name: "Nouvelle Inscription",
                short_name: "Inscription",
                description: "Inscrire un nouvel élève ou étudiant",
                url: "/#/eleves/ajouter",
                icons: [{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" }]
              },
              {
                name: "Économat & Versements",
                short_name: "Paiements",
                description: "Recevoir un paiement et imprimer un reçu",
                url: "/#/economat/paiement",
                icons: [{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" }]
              },
              {
                name: "Cahier de Présence",
                short_name: "Présence",
                description: "Faire l'appel et gérer les retards",
                url: "/#/vie-scolaire/presence",
                icons: [{ src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" }]
              }
            ],
            icons: [
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              },
              {
                src: '/pwa-384x384.png',
                sizes: '384x384',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-256x256.png',
                sizes: '256x256',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-maskable-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
              },
              {
                src: '/pwa-152x152.png',
                sizes: '152x152',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-144x144.png',
                sizes: '144x144',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-128x128.png',
                sizes: '128x128',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-96x96.png',
                sizes: '96x96',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-72x72.png',
                sizes: '72x72',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-64x64.png',
                sizes: '64x64',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-48x48.png',
                sizes: '48x48',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-32x32.png',
                sizes: '32x32',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/pwa-16x16.png',
                sizes: '16x16',
                type: 'image/png',
                purpose: 'any'
              }
            ],
            screenshots: [
              {
                src: '/screenshot-desktop.png',
                sizes: '1280x720',
                type: 'image/png',
                form_factor: 'wide',
                label: 'Tableau de bord et Gestion Institutionnelle EduNova Pro'
              },
              {
                src: '/screenshot-mobile.png',
                sizes: '720x1280',
                type: 'image/png',
                form_factor: 'narrow',
                label: 'Application Mobile et Suivi Pédagogique EduNova'
              }
            ]
          },
          injectManifest: {
            maximumFileSizeToCacheInBytes: 10000000,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
          },
          devOptions: {
            enabled: false,
            type: 'module'
          }
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
