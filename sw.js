const CACHE_NAME = 'one-day-maid-v1';
const STATIC_CACHE_NAME = 'one-day-maid-static-v1';

// Files to cache for offline functionality (only essential files)
const STATIC_FILES = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json'
];

// Files that should always be fetched fresh (no cache)
const NO_CACHE_FILES = [
    '/index.html',
    '/script.js',
    '/styles.css'
];

// Install event - cache essential files
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching essential files');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old caches
                    if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - handle requests with network-first strategy for code files
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip external requests
    if (url.origin !== location.origin) {
        return;
    }

    // Network-first strategy for code files (always get fresh code)
    if (shouldNotCache(url.pathname)) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // If fetch successful, return fresh response
                    return response;
                })
                .catch(() => {
                    // If fetch fails, try to get from cache as fallback
                    return caches.match(request);
                })
        );
        return;
    }

    // Cache-first strategy for other files (icons, images, etc.)
    event.respondWith(
        caches.match(request)
            .then(response => {
                // Return cached version if available
                if (response) {
                    return response;
                }

                // Otherwise fetch from network and cache
                return fetch(request).then(fetchResponse => {
                    // Check if valid response
                    if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                        return fetchResponse;
                    }

                    // Clone the response
                    const responseToCache = fetchResponse.clone();

                    // Cache the response
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(request, responseToCache);
                        });

                    return fetchResponse;
                });
            })
    );
});

// Helper function to check if file should not be cached
function shouldNotCache(pathname) {
    return NO_CACHE_FILES.some(file => pathname.endsWith(file) || pathname === file);
}

// Message event - handle messages from main thread
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background sync for offline actions (optional)
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Handle background sync tasks
            console.log('Service Worker: Background sync triggered')
        );
    }
});

// Push notifications (optional for future use)
self.addEventListener('push', event => {
    if (event.data) {
        const options = {
            body: event.data.text(),
            icon: '/icon-192.png',
            badge: '/icon-72.png',
            vibrate: [200, 100, 200],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Open App',
                    icon: '/icon-96.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/icon-96.png'
                }
            ]
        };

        event.waitUntil(
            self.registration.showNotification('One Day Maid', options)
        );
    }
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Update detection and notification
self.addEventListener('fetch', event => {
    // Check for updates periodically
    if (event.request.url.includes('index.html') || event.request.url === location.origin + '/') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Notify client about potential updates
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'UPDATE_AVAILABLE'
                            });
                        });
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
    }
});
