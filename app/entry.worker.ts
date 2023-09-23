/// <reference lib="WebWorker" />
import { Push } from "@remix-pwa/push";
import { PushPlugin } from "@remix-pwa/push";
import { Storage } from '@remix-pwa/cache';
import { cacheFirst, networkFirst } from '@remix-pwa/strategy';
import type { DefaultFetchHandler } from '@remix-pwa/sw';
import { RemixNavigationHandler, logger, matchRequest } from '@remix-pwa/sw';

declare let self: ServiceWorkerGlobalScope;

const PAGES = 'page-cache';
const DATA = 'data-cache';
const ASSETS = 'assets-cache';

// Open the caches and wrap them in `RemixCache` instances.
const dataCache = Storage.open(DATA, {
  ttl: 60 * 60 * 24 * 7 * 1_000, // 7 days
});
const documentCache = Storage.open(PAGES);
const assetCache = Storage.open(ASSETS);

self.addEventListener('install', (event: ExtendableEvent) => {
  logger.log('Service worker installed');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  logger.log('Service worker activated');
  event.waitUntil(self.clients.claim());
});

const dataHandler = networkFirst({
  cache: dataCache,
});

const assetsHandler = cacheFirst({
  cache: assetCache,
  cacheQueryOptions: {
    ignoreSearch: true,
    ignoreVary: true,
  },
});

// The default fetch event handler will be invoke if the
// route is not matched by any of the worker action/loader.
export const defaultFetchHandler: DefaultFetchHandler = ({ context, request }) => {
  const type = matchRequest(request);

  if (type === 'asset') {
    return assetsHandler(context.event.request);
  }

  if (type === 'loader') {
    return dataHandler(context.event.request);
  }

  return context.fetchFromServer();
};

const handler = new RemixNavigationHandler({
  dataCache,
  documentCache,
});

self.addEventListener('message', event => {
  event.waitUntil(handler.handle(event));
});

class CustomPush extends Push {
  async handlePush(event: PushEvent): Promise<void> {
    const { data } = event;
    await self.registration.showNotification(data?.json().title, data?.json().options);
  }

  async handleNotificationClick(event: NotificationEvent) {
    const { notification } = event;
    console.log(notification)
    if (notification?.data?.url) {
      console.timeLog("Opening window")
      await self.clients.openWindow(notification.data.url);
    }
    notification?.close();
  }

  async handleNotificationClose(event: NotificationEvent) {
    const { notification } = event;
    console.log("Notification with title", `'${notification.title}'`, "closed");
  }

  async handleError(error: ErrorEvent) {
    console.error("An error occurred", error);
  }
}

const pushHandler = new CustomPush();

self.addEventListener("push", (event: PushEvent) => {
  pushHandler.handlePush(event);
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  pushHandler.handleNotificationClick(event);
});

self.addEventListener("notificationclose", (event: NotificationEvent) => {
  pushHandler.handleNotificationClose(event);
});

self.addEventListener("error", (error: ErrorEvent) => {
  pushHandler.handleError(error);
});

interface AnalyticsPluginOptions {
  trackPushReceived?: boolean;
  trackPushClicked?: boolean;
  trackPushDismissed?: boolean;
  trackPushError?: boolean;
}

class AnalyticsPlugin implements PushPlugin {
  private options: AnalyticsPluginOptions;
  private pushReceivedCount = 0;
  private pushClickedCount = 0;
  private pushDismissedCount = 0;
  private errorCount = 0;
  constructor(options: AnalyticsPluginOptions = {}) {
    this.options = {
      trackPushReceived: options.trackPushReceived ?? true,
      trackPushClicked: options.trackPushClicked ?? true,
      trackPushDismissed: options.trackPushDismissed ?? true,
      trackPushError: options.trackPushError ?? true,
      ...options
    };
  }

  async pushReceived({ event, state }: PushHandlerEnv) {
    if (!this.options.trackPushReceived) return;
  
    this.pushReceivedCount++;
    console.log("Push recieved", event);
    console.log(`%cPush received ${this.pushReceivedCount}`, "color: green");
  }

  async pushClicked({ event, state }: PushHandlerEnv) {
    if (!this.options.trackPushClicked) return;

    this.pushClickedCount++;
    console.log("Push clicked", event);
    console.log(`%cPush clicked ${this.pushClickedCount}`, "color: blue");
  }


  async pushDismissed({ event, state }: PushHandlerEnv) {
    if (!this.options.trackPushDismissed) return;

    this.pushDismissedCount++;
    console.log("Push dismissed", event);
    console.log(`%cPush dismissed ${this.pushDismissedCount}`, "color: yellow");
  }

  async error({ event, state }: PushHandlerEnv) {
    if (!this.options.trackPushError) return;
  
    this.errorCount++;
    console.log("Error", event);
    console.log(`%cError ${this.errorCount}`, "color: red");
  }
}

const analyticsPlugin = new AnalyticsPlugin();

const pushHandler = new CustomPush([analyticsPlugin]);

class CustomPush extends Push {
  async handlePush(event: PushEvent): Promise<void> {
    this.applyPlugins("pushReceived", { event });

    // ...
  }

  async handleNotificationClick(event: NotificationEvent): Promise<void> {
    this.applyPlugins("pushClicked", { event });

    // ...
  }

  async handleNotificationClose(event: NotificationEvent): Promise<void> {
    this.applyPlugins("pushDismissed", { event });

    // ...
  }

  async handleError(error: ErrorEvent): Promise<void> {
    this.applyPlugins("error", { event: error });

    // ...
  }
}