// node_modules/cachified/dist/index.mjs
var k = Symbol();
var w = Symbol();
var f = Symbol();

// node_modules/@remix-pwa/cache/dist/src/cache.js
var Strategy;
(function(Strategy2) {
  Strategy2["CacheFirst"] = "cache-first";
  Strategy2["NetworkFirst"] = "network-first";
  Strategy2["CacheOnly"] = "cache-only";
  Strategy2["NetworkOnly"] = "network-only";
  Strategy2["StaleWhileRevalidate"] = "stale-while-revalidate";
})(Strategy || (Strategy = {}));
var RemixCache = class {
  /**
   * Create a new `RemixCache` instance. Don't invoke this directly! Use `RemixCacheStorage.open()` instead.
   * @constructor
   * @param {object} options - Options for the RemixCache instance.
   */
  constructor(options) {
    this._ttl = Infinity;
    this._strategy = Strategy.NetworkFirst;
    this._maxItems = 100;
    this.set = false;
    this.name = options.name;
    this._maxItems = options.maxItems || 100;
    this._strategy = options.strategy || Strategy.NetworkFirst;
    this._ttl = options.ttl || Infinity;
    if (this._strategy === Strategy.NetworkOnly) {
      this._ttl = -1;
    }
    if (options.maxItems || options.ttl || options.strategy) {
      this.set = true;
    } else {
      this.set = false;
    }
  }
  async _openCache() {
    return await caches.open(`rp-${this.name}`);
  }
  async _getOrDeleteIfExpired(key, metadata) {
    if (metadata.expiresAt === "Infinity") {
      return false;
    }
    if (Number(metadata.expiresAt) <= Date.now()) {
      return await this.delete(key);
    }
    return false;
  }
  async _values() {
    const cache = await this._openCache();
    const keys = await cache.keys();
    return await Promise.all(keys.map((key) => cache.match(key)));
  }
  async _lruCleanup() {
    if (await this.length() >= this._maxItems) {
      this._values().then(async (values) => {
        const val = values.sort((a, b2) => {
          const aMeta = a.clone().json().metadata;
          const bMeta = b2.clone().json().metadata;
          return aMeta.accessedAt - bMeta.accessedAt;
        })[0];
        this.delete(val.url);
      });
    }
  }
  async _getResponseValue(request, response) {
    const { metadata, value } = await response.clone().json();
    const deleted = await this._getOrDeleteIfExpired(request.clone(), metadata);
    const headers = new Headers(response.clone().headers);
    if (!this.set) {
      this.set = true;
      this._ttl = metadata.cacheTtl;
      this._maxItems = metadata.cacheMaxItems;
      this._strategy = metadata.cacheStrategy;
    }
    if (!deleted) {
      const res = new Response(value, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(headers.entries()),
          "Content-Type": headers.get("X-Remix-PWA-Original-Content-Type") || "application/json",
          "X-Remix-PWA-TTL": metadata.expiresAt.toString(),
          "X-Remix-PWA-AccessTime": metadata.accessedAt.toString()
        }
      });
      await this.put(request, res.clone(), void 0);
      return res;
    }
    return void 0;
  }
  /**
   * Delete an entry from the cache.
   * Takes in the same parameters as `Cache.delete`.
   * @param {RequestInfo | URL} request - The request to delete.
   * @param {CacheQueryOptions} [options] - Options for the delete operation.
   * @returns {Promise<boolean>} Returns `true` if an entry was deleted, otherwise `false`.
   *
   * @example
   * ```js
   * const cache = await initCache({ name: 'my-cache' });
   *
   * await cache.put('/hello-world', new Response('Hello World!'));
   * await cache.delete('/hello-world');
   * ```
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Cache/delete
   */
  async delete(request, options) {
    return this._openCache().then((cache) => cache.delete(request, options));
  }
  /**
   * Returns a Promise that resolves to the length of the Cache object.
   *
   * @returns {Promise<number>} The number of entries in the cache.
   */
  async length() {
    const keys = await this.keys();
    return keys.length;
  }
  /**
   * Returns a `Promise` that resolves to an array of Cache keys.
   *
   * @returns {Promise<readonly Request[]>} An array of Cache keys.
   */
  async keys() {
    const cache = await this._openCache();
    return await cache.keys();
  }
  /**
   * Return a `Promise` that resolves to an entry in the cache object. Accepts the
   * same parameters as `Cache.match`.
   *
   * @param {RequestInfo | URL} request - The request to match.
   * @param {CacheQueryOptions} [options] - Options for the match operation.
   *
   * @returns {Promise<Response | undefined>} A `Promise` that resolves to the response, or `undefined` if not found.
   */
  async match(request, options) {
    const cache = await this._openCache();
    if (request instanceof URL || typeof request === "string") {
      request = new Request(request);
    }
    const response = await cache.match(request.clone(), options);
    if (!response) {
      return void 0;
    }
    return await this._getResponseValue(request, response.clone());
  }
  /**
   * Add an entry to the cache.
   * Takes in the same parameters as `Cache.put`.
   *
   * @param {RequestInfo | URL} request - The request to add.
   * @param {Response} response - The response to add.
   * @param {number | undefined} ttl - The time-to-live of the cache entry in ms. Defaults to cache ttl.
   * @returns {Promise<void>} A `Promise` that resolves when the entry is added to the cache.
   *
   * @example
   * ```js
   * const cache = await initCache({ name: 'my-cache' });
   *
   * await cache.put('/hello-world', new Response('Hello World!'));
   * ```
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Cache/put
   */
  async put(request, response, ttl = void 0) {
    const cache = await this._openCache();
    if (request instanceof URL || typeof request === "string") {
      request = new Request(request);
    }
    if (this._ttl <= 0 || ttl && ttl <= 0)
      return;
    const contentType = response.headers.get("Content-Type");
    let data;
    if (contentType && contentType.includes("application/json")) {
      data = await response.clone().json();
    } else {
      data = await response.clone().text();
    }
    if (!this.set) {
      this.set = true;
      const keys = await cache.keys();
      const firstVal = await cache.match(keys[0]);
      if (firstVal) {
        const { metadata } = await firstVal.clone().json();
        this._ttl = metadata.cacheTtl;
        this._maxItems = metadata.cacheMaxItems;
        this._strategy = metadata.cacheStrategy;
      } else {
        this._ttl = Infinity;
        this._maxItems = 100;
        this._strategy = Strategy.NetworkFirst;
      }
    }
    const expiresAt = Date.now() + (ttl ?? this._ttl);
    const accessedAt = Date.now();
    const resHeaders = response.clone().headers;
    response = new Response(JSON.stringify({
      metadata: {
        accessedAt,
        // JSON can't store `Infinity`, so we store it as a string
        expiresAt: expiresAt.toString(),
        cacheTtl: this._ttl.toString(),
        cacheMaxItems: this._maxItems,
        cacheStrategy: this._strategy
      },
      value: data
    }), {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(resHeaders.entries()),
        "Content-Type": "application/json",
        "X-Remix-PWA-Original-Content-Type": contentType || "text/plain",
        "X-Remix-PWA-TTL": expiresAt.toString(),
        "X-Remix-PWA-AccessTime": resHeaders.get("X-Remix-PWA-AccessTime") || accessedAt.toString()
      }
    });
    try {
      await this._lruCleanup();
      return await cache.put(request, response.clone());
    } catch (error) {
      console.error("Failed to put to cache:", error);
    }
  }
  async add(request) {
    return (
      /* await - should this be awaited? */
      fetch(request).then((res) => {
        if (!res.ok) {
          throw new Error("Failed to fetch");
        }
        return this.put(request, res.clone());
      })
    );
  }
  get ttl() {
    return this._ttl;
  }
  get strategy() {
    return this._strategy;
  }
};

// node_modules/@remix-pwa/cache/dist/src/storage.js
var RemixCacheStorage = class {
  // eslint-disable-next-line no-useless-constructor
  constructor() {
  }
  /**
   * Initialize the Remix PWA Cache Storage. This will create a special cache for each
   * existing cache in the browser or create a new map if none exist.
   *
   * Use in your service worker installation script. Make sure to call this before
   * initializing any `RemixCache` instance.
   *
   * @example
   * ```js
   * import { RemixCacheStorage } from '@remix-run/cache';
   *
   * self.addEventListener('install', (event) => {
   *  event.waitUntil(Promise.all[
   *   RemixCacheStorage.init(),
   *   // other stuff
   *  ]);
   * });
   * ```
   */
  // static async init() {
  //   if (typeof caches === 'undefined') {
  //     throw new Error('Cache API is not available in this environment.');
  //   }
  //   if (this._instances.size > 0) {
  //     return;
  //   }
  //   const cachesNames = await caches.keys();
  //   for (const name of cachesNames) {
  //     if (name.startsWith('rp-')) {
  //       this._instances.set(name, new RemixCache({ name }));
  //     }
  //   }
  // }
  /**
   * Create a custom cache that you can use across your application.
   * Use this instead of initialising `RemixCache` directly.
   */
  static createCache(opts) {
    const { name } = opts;
    if (this._instances.has(name)) {
      return this._instances.get(name);
    }
    const newCache = new RemixCache(opts);
    this._instances.set(`${name}`, newCache);
    caches.open(`rp-${name}`);
    return newCache;
  }
  /**
   * Check wether a cache with the given name exists.
   *
   * @param name
   */
  static has(name) {
    return this._instances.has(name);
  }
  /**
   * Get a cache by name. Returns `undefined` if no cache with the given name exists.
   * Use `has` to check if a cache exists. Or `open` to create one automatically if non exists.
   *
   * @param name
   * @returns {RemixCache | undefined}
   *
   * @example
   * ```js
   * import { Storage } from '@remix-run/cache';
   *
   * const cache = Storage.get('my-cache');
   * ```
   */
  static get(name) {
    return this._instances.get(name);
  }
  /**
   * Get a cache by name. If no cache with the given name exists, create one.
   *
   * @param name Name of the cache - **must be unique**
   * @param opts Options to pass to the `RemixCache` constructor if the cache is getting created
   * @returns {RemixCache}
   *
   * @example
   * ```js
   * import { Storage } from '@remix-run/cache';
   *
   * const cache = Storage.open('my-cache');
   * ```
   */
  static open(name, opts) {
    const cache = this._instances.get(name);
    if (!cache) {
      return this.createCache({ name, ...opts });
    }
    return cache;
  }
  /**
   * Delete a cache by name.
   *
   * @param name
   */
  static delete(name) {
    const cache = this._instances.get(name);
    if (cache) {
      caches.delete(`rp-${name}`);
      this._instances.delete(name);
    }
  }
  /**
   * Delete all caches.
   */
  static clear() {
    caches.keys().then((keys) => keys.forEach((key) => key.startsWith("rp-") ? caches.delete(key) : null));
    this._instances = /* @__PURE__ */ new Map();
  }
  /**
   * Get all caches. **Don't use this except you know what you are doing!**
   *
   * Which, frankly speaking, you probably don't. So shoo away!
   */
  static get instances() {
    return this._instances;
  }
  /**
   * Get the number of caches.
   *
   * Return the length of the `RemixCacheStorage` store.
   */
  static get _length() {
    return this._instances.size;
  }
  /**
   * Check if a request is stored as the key of a response in all caches.
   *
   * Experimental. Use at your own risk!
   *
   * @param {RequestInfo | URL} request The request to check.
   * @param {CacheQueryOptions} [options] Options to pass to the `Cache.match` method.
   * @returns {Promise<Response | undefined>} A promise that resolves to the response if found, otherwise `undefined`.
   */
  static _match(request, options) {
    return caches.match(request, options);
  }
};
RemixCacheStorage._instances = /* @__PURE__ */ new Map();
var Storage = RemixCacheStorage;

// node_modules/@remix-pwa/strategy/dist/src/utils.js
var isHttpRequest = (request) => {
  if (request instanceof Request) {
    return request.url.startsWith("http");
  }
  return request.toString().startsWith("http");
};

// node_modules/@remix-pwa/strategy/dist/src/cacheFirst.js
var cacheFirst = ({ cache: cacheName, cacheOptions, cacheQueryOptions, fetchDidFail = void 0 }) => {
  return async (request) => {
    if (!isHttpRequest(request)) {
      return new Response("Not a HTTP request", { status: 403 });
    }
    let remixCache;
    if (typeof cacheName === "string") {
      remixCache = Storage.open(cacheName, cacheOptions);
    } else {
      remixCache = cacheName;
    }
    const response = await remixCache.match(request, cacheQueryOptions);
    if (!response) {
      try {
        const networkResponse = await fetch(request);
        remixCache.put(request, networkResponse.clone());
        return networkResponse;
      } catch (err) {
        if (fetchDidFail) {
          await Promise.all(fetchDidFail.map((cb) => cb()));
        }
        throw err;
      }
    }
    return response;
  };
};

// node_modules/@remix-pwa/strategy/dist/src/networkFirst.js
var networkFirst = ({ cache: cacheName, cacheOptions, cacheQueryOptions, fetchDidFail = void 0, fetchDidSucceed = void 0, networkTimeoutSeconds = 10 }) => {
  return async (request) => {
    if (!isHttpRequest(request)) {
      return new Response("Not a HTTP request", { status: 403 });
    }
    let remixCache;
    if (typeof cacheName === "string") {
      remixCache = Storage.open(cacheName, cacheOptions);
    } else {
      remixCache = cacheName;
    }
    try {
      const timeoutPromise = networkTimeoutSeconds !== Infinity ? new Promise((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Network timed out after ${networkTimeoutSeconds} seconds`));
        }, networkTimeoutSeconds * 1e3);
      }) : null;
      const response = timeoutPromise ? await Promise.race([fetch(request), timeoutPromise]) : await fetch(request);
      if (response) {
        if (fetchDidSucceed) {
          await Promise.all(fetchDidSucceed.map((cb) => cb()));
        }
        await remixCache.put(request, response.clone());
        return response.clone();
      }
    } catch (error) {
      if (fetchDidFail) {
        await Promise.all(fetchDidFail.map((cb) => cb()));
      }
      const cachedResponse = await remixCache.match(request, cacheQueryOptions);
      if (cachedResponse) {
        return cachedResponse.clone();
      }
      return new Response(JSON.stringify({ message: "Network Error" }), {
        status: 500
      });
    }
    throw new Error("Failed to fetch. Network timed out.");
  };
};

// node_modules/@remix-pwa/sw/dist/src/private/logger.js
var methodToColorMap = {
  debug: `#7f8c8d`,
  log: `#2ecc71`,
  info: `#3498db`,
  warn: `#f39c12`,
  error: `#c0392b`,
  groupCollapsed: `#3498db`,
  groupEnd: null
  // No colored prefix on groupEnd
};
var logger = false ? (() => {
  const api = {};
  const loggerMethods = Object.keys(methodToColorMap);
  for (const key of loggerMethods) {
    const method = key;
    api[method] = noop;
  }
  return api;
})() : (() => {
  let inGroup = false;
  const print = function(method, args) {
    if (self.__DISABLE_PWA_DEV_LOGS) {
      return;
    }
    if (method === "debug" && self.__DISABLE_PWA_DEBUG_LOGS) {
      return;
    }
    if (method === "info" && self.__DISABLE_PWA_INFO_LOGS) {
      return;
    }
    if (method === "warn" && self.__DISABLE_PWA_WARN_LOGS) {
      return;
    }
    if (method === "error" && self.__DISABLE_PWA_ERROR_LOGS) {
      return;
    }
    if (method === "groupCollapsed") {
      if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
        console[method](...args);
        return;
      }
    }
    const styles = [
      `background: ${methodToColorMap[method]}`,
      `border-radius: 0.5em`,
      `color: white`,
      `font-weight: bold`,
      `padding: 2px 0.5em`
    ];
    const logPrefix = inGroup ? [] : ["%cremix-pwa", styles.join(";")];
    console[method](...logPrefix, ...args);
    if (method === "groupCollapsed") {
      inGroup = true;
    }
    if (method === "groupEnd") {
      inGroup = false;
    }
  };
  const api = {};
  const loggerMethods = Object.keys(methodToColorMap);
  for (const key of loggerMethods) {
    const method = key;
    api[method] = (...args) => {
      print(method, args);
    };
  }
  return api;
})();

// node_modules/@remix-pwa/sw/dist/src/utils/worker.js
function isMethod(request, methods) {
  return methods.includes(request.method.toLowerCase());
}
function isAssetRequest(request, assetUrls = ["/build/", "/icons"]) {
  return isMethod(request, ["get"]) && assetUrls.some((publicPath) => request.url.includes(publicPath));
}
function isLoaderRequest(request) {
  const url = new URL(request.url);
  return isMethod(request, ["get"]) && url.searchParams.get("_data");
}
var matchRequest = (request, assetUrls = ["/build/", "/icons"]) => {
  if (isAssetRequest(request, assetUrls)) {
    return "asset";
  } else if (isLoaderRequest(request)) {
    return "loader";
  } else {
    return null;
  }
};

// node_modules/@remix-pwa/sw/dist/src/message/message.js
var MessageHandler = class {
  /**
   * The plugins array is used to run plugins before and after the message handler.
   * They are passed in when the handler is initialised.
   */
  plugins;
  /**
   * The state object is used to pass data between plugins.
   */
  state;
  constructor({ plugins, state } = {}) {
    this.plugins = plugins || [];
    this.state = state || {};
  }
  /**
   * The method that handles the message event.
   *
   * Takes in the MessageEvent as a mandatory argument as well as an optional
   * object that can be used to pass further information/data.
   */
  async handle(event, state = {}) {
    await this._handleMessage(event, state);
  }
  /**
   * Runs the plugins that are passed in when the handler is initialised.
   */
  async runPlugins(hook, env) {
    for (const plugin of this.plugins) {
      if (plugin[hook]) {
        plugin[hook](env);
      }
    }
  }
};

// node_modules/@remix-pwa/sw/dist/src/message/remixNavigationHandler.js
var RemixNavigationHandler = class extends MessageHandler {
  dataCacheName;
  documentCacheName;
  constructor({ dataCache: dataCache2, documentCache: documentCache2, plugins, state }) {
    super({ plugins, state });
    this.dataCacheName = dataCache2;
    this.documentCacheName = documentCache2;
    this._handleMessage = this._handleMessage.bind(this);
  }
  async _handleMessage(event) {
    const { data } = event;
    let dataCache2, documentCache2;
    dataCache2 = this.dataCacheName;
    documentCache2 = this.documentCacheName;
    this.runPlugins("messageDidReceive", {
      event
    });
    const cachePromises = /* @__PURE__ */ new Map();
    if (data.type === "REMIX_NAVIGATION") {
      const { isMount, location, manifest, matches } = data;
      const documentUrl = location.pathname + location.search + location.hash;
      if (typeof dataCache2 === "string") {
        dataCache2 = Storage.open(dataCache2);
      }
      if (typeof documentCache2 === "string") {
        documentCache2 = Storage.open(documentCache2);
      }
      const existingDocument = await Storage._match(documentUrl);
      if (!existingDocument || !isMount) {
        const response = await fetch(documentUrl);
        cachePromises.set(documentUrl, documentCache2.put(documentUrl, response).catch((error) => {
          logger.error(`Failed to cache document for ${documentUrl}:`, error);
        }));
      }
      if (isMount) {
        for (const match of matches) {
          if (manifest.routes[match.id].hasLoader) {
            const params = new URLSearchParams(location.search);
            params.set("_data", match.id);
            let search = params.toString();
            search = search ? `?${search}` : "";
            const url = location.pathname + search + location.hash;
            if (!cachePromises.has(url)) {
              logger.debug("Caching data for:", url);
              const response = await fetch(url);
              cachePromises.set(url, dataCache2.put(url, response).catch((error) => {
                logger.error(`Failed to cache data for ${url}:`, error);
              }));
            }
          }
        }
      }
    }
    await Promise.all(cachePromises.values());
  }
};

// app/entry.worker.ts
var PAGES = "page-cache";
var DATA = "data-cache";
var ASSETS = "assets-cache";
var dataCache = Storage.open(DATA, {
  ttl: 60 * 60 * 24 * 7 * 1e3
  // 7 days
});
var documentCache = Storage.open(PAGES);
var assetCache = Storage.open(ASSETS);
self.addEventListener("install", (event) => {
  logger.log("Service worker installed");
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  logger.log("Service worker activated");
  event.waitUntil(self.clients.claim());
});
var dataHandler = networkFirst({
  cache: dataCache
});
var assetsHandler = cacheFirst({
  cache: assetCache,
  cacheQueryOptions: {
    ignoreSearch: true,
    ignoreVary: true
  }
});
var defaultFetchHandler = ({ context, request }) => {
  const type = matchRequest(request);
  if (type === "asset") {
    return assetsHandler(context.event.request);
  }
  if (type === "loader") {
    return dataHandler(context.event.request);
  }
  return context.fetchFromServer();
};
var handler = new RemixNavigationHandler({
  dataCache,
  documentCache
});
self.addEventListener("message", (event) => {
  event.waitUntil(handler.handle(event));
});
self.addEventListener("push", (event) => {
});
self.addEventListener("notificationclick", (event) => {
});
self.addEventListener("notificationclose", (event) => {
});
self.addEventListener("error", (error) => {
});
export {
  defaultFetchHandler
};
