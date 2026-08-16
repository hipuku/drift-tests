/** Discovery steps. */

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";
import { DriftWorld } from "../support/world.js";

When("I discover the fixture site", async function (this: DriftWorld) {
  await this.post("/discover", { url: this.fixture.baseUrl });
});

When("I discover {string}", async function (this: DriftWorld, url: string) {
  await this.post("/discover", { url });
});

Then(
  "the discovered pages include the {string} path",
  function (this: DriftWorld, path: string) {
    const body = this.lastResponse?.body;
    const pages: unknown = body?.pages;
    assert.ok(Array.isArray(pages), `expected a pages array, got ${JSON.stringify(body)}`);
    // Pages may be strings or objects with a url — normalise to a URL string.
    const urls = pages.map((p: any) => (typeof p === "string" ? p : p?.url)).filter(Boolean);
    assert.ok(
      urls.some((u: string) => new URL(u).pathname === path),
      `expected a page at ${path}, got: ${urls.join(", ")}`,
    );
  },
);
