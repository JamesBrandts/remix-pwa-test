import { useState } from "react";
// import { subscribeToPush } from "@remix-pwa/push";

export function postToServer(url, data) {
  return __awaiter(this, void 0, void 0, function* () {
      let response = yield fetch(url, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
      });
      return response;
  });
}

export const urlB64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export function subscribeToPush(PUBLIC_KEY: string, pushRoute = '/push', type = 'subscribe', payload = {}) {
  return __awaiter(this, void 0, void 0, function* () {
      const registration = yield navigator.serviceWorker.getRegistration();
      const subscription = yield (registration === null || registration === void 0 ? void 0 : registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(PUBLIC_KEY)
      }));
      const data = yield postToServer(pushRoute, { subscription, type, payload });
      return data;
  });
}

export default function PushRoute() {
  const [subscribed, setSubscribed] = useState(false);

  const subscribe = async () => {
    const subscription = await subscribeToPush("BPFA0fet5DS8dVhl3-LDbuGFm6ZDL1DH680_WCy_p5mNHrnDbqIGQFLx9aMVG3vGN9imCw7hJ1yByU9XCsjcqqA", "/push");
    window.localStorage.setItem("subscription", JSON.stringify(subscription));
  setSubscribed(true);
  };

  const sendPush = async () => {
    const subscription = JSON.parse(window.localStorage.getItem("subscription")!);
  
    const res = await fetch("/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "notify",
        subscription
      })
    });
  
    if (res.ok) {
      console.log("Push sent!");
    }
  };  

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
      <h1>Welcome to Remix Push</h1>
      <div style={{ display: "flex", flexDirection: "row" }}>
        <h2 style={{ margin: "12px 16px" }}>Subscribe to Notifications?</h2>
        <button onClick={subscribe} style={{ padding: "4px 12px" }}>Subscribe Me!</button>
        <button onClick={sendPush} style={{ padding: "4px 12px" }}>Push</button>
      </div>
    </div>
  );
}

function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
  return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) { try {
          step(generator.next(value));
      }
      catch (e) {
          reject(e);
      } }
      function rejected(value) { try {
          step(generator["throw"](value));
      }
      catch (e) {
          reject(e);
      } }
      function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}

