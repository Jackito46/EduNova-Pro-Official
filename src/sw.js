import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// Versioning des caches d'exécution pour garantir la purge immédiate lors d'une montée de version
const CACHE_VERSION = 'v3.2';
const CACHE_PREFIX = 'edunova';

const CACHE_NAMES = {
  html: `${CACHE_PREFIX}-html-${CACHE_VERSION}`,
  static: `${CACHE_PREFIX}-static-${CACHE_VERSION}`,
  fonts: `${CACHE_PREFIX}-fonts-${CACHE_VERSION}`,
  supabase: `${CACHE_PREFIX}-supabase-${CACHE_VERSION}`,
};

self.skipWaiting();
clientsClaim();

// 1. Nettoyage préventif des caches de préchargement Workbox obsolètes
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// 2. Événement ACTIVATE : Détection et suppression agressive de TOUS les anciens caches obsolètes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheKeys = await caches.keys();
        const activeCachesList = Object.values(CACHE_NAMES);

        const deletePromises = cacheKeys.map(async (key) => {
          // Conserver le precache actif généré par Workbox pour la version actuelle
          const isCurrentWorkboxPrecache = key.startsWith('workbox-precache-');
          const isCurrentRuntimeCache = activeCachesList.includes(key);

          // Si le cache ne correspond à aucun des caches valides de la version actuelle, le supprimer
          if (!isCurrentRuntimeCache && !isCurrentWorkboxPrecache) {
            console.log(`[EduNova SW] 🧹 Suppression automatique de l'ancien cache : ${key}`);
            return caches.delete(key);
          }

          // Si c'est un ancien cache de préchargement temporaire
          if (key.includes('workbox-precache-temp')) {
            return caches.delete(key);
          }
        });

        await Promise.all(deletePromises);
        console.log(`[EduNova SW] ✨ Nettoyage des anciens caches terminé (${CACHE_VERSION}).`);
      } catch (err) {
        console.warn('[EduNova SW] Erreur lors de la purge des anciens caches :', err);
      }

      // Prendre le contrôle immédiat de toutes les fenêtres ouvertes
      await self.clients.claim();
    })()
  );
});

// 3. Stratégie NetworkFirst pour les requêtes de navigation HTML
// Garantit la fraîcheur de l'application tout en conservant le mode 100% hors-ligne
const navigationStrategy = new NetworkFirst({
  cacheName: CACHE_NAMES.html,
  networkTimeoutSeconds: 3,
  plugins: [
    new ExpirationPlugin({
      maxEntries: 5,
      maxAgeSeconds: 24 * 60 * 60, // 24 heures
      purgeOnQuotaError: true, // Libère automatiquement l'espace si l'appareil manque de stockage
    }),
  ],
});

registerRoute(
  new NavigationRoute(
    async (params) => {
      try {
        return await navigationStrategy.handle(params);
      } catch (err) {
        // Fallback ultime sur le index.html préchargé en mode 100% hors-ligne
        const precachedHtml = await matchPrecache('/index.html');
        if (precachedHtml) {
          return precachedHtml;
        }
        throw err;
      }
    },
    {
      denylist: [/^\/api\//] // Ne jamais intercepter les requêtes API
    }
  )
);

// 4. Cache Google Fonts avec expiration optimisée
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: CACHE_NAMES.fonts,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 60 * 60 * 24 * 90, // 90 jours
        purgeOnQuotaError: true,
      })
    ]
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: CACHE_NAMES.fonts,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 12,
        maxAgeSeconds: 60 * 60 * 24 * 90, // 90 jours
        purgeOnQuotaError: true,
      })
    ]
  })
);

// 5. Cache des ressources statiques (images, styles, scripts non préchargés)
registerRoute(
  ({ request }) => ['image', 'style', 'script', 'font'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.static,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60, // Limite stricte pour économiser l'espace de stockage
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 jours
        purgeOnQuotaError: true,
      })
    ]
  })
);

// 6. Exclusion stricte des routes d'authentification Supabase et sessions
registerRoute(
  ({ url }) => url.origin.includes('supabase.co') && (url.pathname.includes('/auth/v1/') || url.pathname.includes('invalidate_user_sessions')),
  new NetworkOnly()
);

// 7. Cache Supabase REST GET avec limitation stricte et purge automatique de quota
registerRoute(
  ({ url, request }) => 
    url.origin.includes('supabase.co') && 
    request.method === 'GET' && 
    !url.pathname.includes('/auth/v1/') &&
    !url.pathname.includes('invalidate_user_sessions'),
  new StaleWhileRevalidate({
    cacheName: CACHE_NAMES.supabase,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 3 * 24 * 60 * 60, // 3 jours
        purgeOnQuotaError: true,
      })
    ]
  })
);

// 8. Background Sync pour requêtes hors-ligne
const bgSyncPlugin = new BackgroundSyncPlugin('edunova-offline-queue', {
  maxRetentionTime: 24 * 60 // 24 heures
});

registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'PATCH'
);

registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'DELETE'
);

// 9. Écouteur de messages (Skip waiting, purge sélective et nettoyage forcé)
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING' || event.data === 'SKIP_WAITING') {
      self.skipWaiting();
    }
    if (event.data.type === 'CLAIM_CLIENTS') {
      self.clients.claim();
    }
    // Purge de l'ensemble des anciens caches à la demande
    if (event.data.type === 'CLEAR_OUTDATED_CACHES' || event.data.type === 'CLEAR_CACHE') {
      event.waitUntil(
        (async () => {
          const keys = await caches.keys();
          const activeList = Object.values(CACHE_NAMES);
          await Promise.all(
            keys.map((k) => {
              if (!activeList.includes(k) && !k.startsWith('workbox-precache-')) {
                console.log(`[EduNova SW] Purge explicite demandée pour : ${k}`);
                return caches.delete(k);
              }
            })
          );
        })()
      );
    }
    if (event.data.type === 'PURGE_SESSION_CACHE' || event.data.type === 'FORCE_LOGOUT') {
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames
              .filter((name) => name.includes('supabase') || name.includes('session') || name.includes('user'))
              .map((name) => caches.delete(name))
          );
        })
      );
    }
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Notification', options: {} };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: event.data.text(), options: {} };
    }
  }

  const { title, options } = payload;
  
  if (!options.icon) {
    options.icon = '/pwa-192x192.png';
  }

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'PUSH_RECEIVED', payload: payload });
        });
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
