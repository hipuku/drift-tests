/**
 * A tiny webhook receiver on 127.0.0.1 that records what Drift POSTs to it.
 *
 * Drift's SSRF guard refuses loopback callback URLs by default, so the backend
 * under test is started with `DRIFT_WEBHOOK_ALLOWED_HOSTS=127.0.0.1` to permit
 * this receiver. That is the only reason a loopback receiver works, and it is
 * exactly the mechanism a real deployment would use to allowlist a trusted
 * internal endpoint.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

export interface ReceivedWebhook {
  headers: Record<string, string | string[] | undefined>;
  body: any;
}

export interface WebhookReceiver {
  /** The callback URL to hand to Drift. */
  url: string;
  /** Every request received, in order. */
  received: ReceivedWebhook[];
  /** Resolve once at least one webhook has arrived, or reject on timeout. */
  waitForOne: (timeoutMs?: number) => Promise<ReceivedWebhook>;
  close: () => Promise<void>;
}

export async function startWebhookReceiver(): Promise<WebhookReceiver> {
  const received: ReceivedWebhook[] = [];

  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      let body: any = raw;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        // keep the raw string
      }
      received.push({ headers: req.headers, body });
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/hook`,
    received,
    waitForOne: (timeoutMs = 60_000) =>
      new Promise<ReceivedWebhook>((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const tick = () => {
          if (received.length > 0) return resolve(received[0]);
          if (Date.now() > deadline) return reject(new Error("no webhook received in time"));
          setTimeout(tick, 250);
        };
        tick();
      }),
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
