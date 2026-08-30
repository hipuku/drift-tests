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
    // Pages may be strings or objects carrying a url — normalise to a URL
    // string. Narrowed here rather than typed as `any`: this shape is small
    // enough to state, unlike the response bodies, which wait on types
    // generated from drift's published openapi.yaml.
    const urlOf = (page: unknown): string | undefined => {
      if (typeof page === "string") return page;
      if (page && typeof page === "object" && "url" in page) {
        const { url } = page as { url: unknown };
        return typeof url === "string" ? url : undefined;
      }
      return undefined;
    };
    const urls = pages.map(urlOf).filter((u): u is string => Boolean(u));
    assert.ok(
      urls.some((u) => new URL(u).pathname === path),
      `expected a page at ${path}, got: ${urls.join(", ")}`,
    );
  },
);
