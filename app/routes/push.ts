import { sendNotifications } from "@remix-pwa/push";
import { type ActionFunction, json } from "@remix-run/node";

export const action: ActionFunction = async ({ request }) => {
    const body = await request.json();
  
    const { type } = body;
  
    switch (type) {
      case "subscribe":
        console.log("subscribed");
        return json(body.subscription, {
          status: 201
        });
      case "unsubscribe":
        console.log("unsubscribed");
        return json(true, {
          status: 200
        });
        case "notify":
  console.log("notified");
  const notification = {
    title: "Hello from Remix!",
    options: {
      body: "This is a notification from Remix!",
      icon: "/favicon.png",
    },
  }

  sendNotifications({
    subscriptions: [body.subscription],
    ttl: 15_000,
    vapidDetails: {
      subject: "mailto:test@test.com",
      publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
      privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    },
    notification,
  });
  break;
    }
  
    return null;
  };