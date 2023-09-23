import { subscribeToPush } from "@remix-pwa/push";
import { useState } from "react";

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