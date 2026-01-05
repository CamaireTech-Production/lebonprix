import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@services': path.resolve(__dirname, './src/services'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@contexts': path.resolve(__dirname, './src/contexts'),
        '@types': path.resolve(__dirname, './src/types'),
        '@constants': path.resolve(__dirname, './src/constants'),
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.ico', 'apple-icon.png', 'android-icon-192x192.png', 'ms-icon-310x310.png'],
        manifest: {
          name: 'Geskap',
          short_name: 'Geskap',
          description: 'Diversité en un clic, votre boutique, votre choix',
          theme_color: '#10b981',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          categories: ['business', 'productivity', 'shopping'],
          lang: 'fr',
          dir: 'ltr',
          icons: [
            {
              src: 'android-icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'android-icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'ms-icon-310x310.png',
              sizes: '310x310',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'ms-icon-310x310.png',
              sizes: '310x310',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Enable immediate activation of new service worker
          skipWaiting: true,
          // Take control of all clients immediately
          clientsClaim: true,
          runtimeCaching: [
            // Use StaleWhileRevalidate for HTML/JS/CSS - serves cached immediately, updates in background
            {
              urlPattern: /\.(?:html|js|css|mjs)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'app-assets-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                }
              }
            },
            {
              urlPattern: /^https:\/\/.*\.firebaseapp\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'firebase-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 // 1 day
                },
                networkTimeoutSeconds: 3
              }
            },
            {
              // Ne jamais mettre en cache les flux Firestore (Listen/channel)
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'NetworkOnly',
              options: {
                cacheName: 'firestore-bypass'
              }
            },
            {
              // Autres endpoints googleapis restent en NetworkFirst
              urlPattern: ({ url }) =>
                url.hostname.endsWith('googleapis.com') &&
                url.hostname !== 'firestore.googleapis.com',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'google-apis-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 1 day
                },
                networkTimeoutSeconds: 5
              }
            },
            {
              urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'firebase-realtime-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 1 day
                },
                networkTimeoutSeconds: 3
              }
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    define: {
      'process.env': env,
    },
    server: {
      port: 3010, // Change this to your desired port
      headers: {
        'Service-Worker-Allowed': '/',
      },
      maxHttpHeaderSize: 16384,
    },
  };
});
