/**
 * The Cucumber World.
 *
 * One instance per scenario. Holds the Drift base URL, a thin HTTP client over
 * global fetch, and the last response so steps can assert on it. Also carries
 * the shared fixture site handle (attached once in BeforeAll).
 */

import { setWorldConstructor, World, type IWorldOptions } from "@cucumber/cucumber";
import type { FixtureSite } from "./fixtureSite.js";

/** Base URL of the Drift API under test. CI sets this; defaults to local dev. */
export const DRIFT_URL = process.env.DRIFT_URL ?? "http://127.0.0.1:3001";

export interface ApiResponse {
  status: number;
  body: any;
}

export interface JobResult {
  status: string;
  result: unknown | null;
  error?: string;
}

/**
 * Shared across every scenario. The fixture only needs starting once, in
 * BeforeAll.
 *
 * Deliberately not exported. Steps reach it through `this.fixture`, which throws
 * a useful message when it is unset; a step that imported the binding directly
 * would instead see `undefined` and fail somewhere further along, describing a
 * symptom rather than the cause. `closeFixture` exists so AfterAll can tear it
 * down without the binding leaking for that one caller.
 */
let fixture: FixtureSite | undefined;

export function setFixture(f: FixtureSite): void {
  fixture = f;
}

export async function closeFixture(): Promise<void> {
  await fixture?.close();
  fixture = undefined;
}

export class DriftWorld extends World {
  lastResponse?: ApiResponse;
  jobId?: string;
  terminal?: JobResult;
  audit?: any;
  receiver?: import("./webhookReceiver.js").WebhookReceiver;
  deliveredWebhook?: import("./webhookReceiver.js").ReceivedWebhook;

  constructor(options: IWorldOptions) {
    super(options);
  }

  get fixture(): FixtureSite {
    if (!fixture) throw new Error("fixture site not started; check BeforeAll");
    return fixture;
  }

  async post(path: string, body: unknown): Promise<ApiResponse> {
    const res = await fetch(`${DRIFT_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    this.lastResponse = { status: res.status, body: await safeJson(res) };
    return this.lastResponse;
  }

  async get(path: string): Promise<ApiResponse> {
    const res = await fetch(`${DRIFT_URL}${path}`);
    this.lastResponse = { status: res.status, body: await safeJson(res) };
    return this.lastResponse;
  }

  /**
   * Enqueue a crawl and poll /result until it leaves the queue. Returns the
   * terminal job state (completed or failed), or throws on timeout.
   */
  async runCrawlToCompletion(jobId: string, timeoutMs = 75_000): Promise<JobResult> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await this.get(`/crawl/${jobId}/result`);
      const state = res.body as JobResult;
      if (state.status === "completed" || state.status === "failed") return state;
      await sleep(1000);
    }
    throw new Error(`crawl ${jobId} did not finish within ${timeoutMs}ms`);
  }
}

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

setWorldConstructor(DriftWorld);
