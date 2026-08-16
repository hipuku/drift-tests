/**
 * A tiny, deliberately-inconsistent static site served on 127.0.0.1.
 *
 * Drift crawls this instead of the public internet, so the suite is hermetic
 * and deterministic: the same off-grid spacing, off-scale type, near-duplicate
 * colours and failing-contrast pair on every run. Three same-origin pages, the
 * homepage linking to the other two, so link-fallback discovery finds them
 * (there is intentionally no sitemap or robots.txt).
 */

import http from "node:http";
import type { AddressInfo } from "node:net";

// Shared, on-purpose-messy stylesheet. The numbers are chosen to trip specific
// audit signals so scenarios can assert on them:
//   - #3366cc vs #3467cc  → perceptually near-duplicate colours (ΔE < ~2)
//   - padding: 13px / 7px → off a 4px grid
//   - font-size: 15/19/23 → off the closest modular scale
//   - #999 on #fff        → ~2.85:1, fails WCAG AA for normal text
const STYLE = `
  :root { color-scheme: light; }
  body { margin: 0; font-family: Georgia, serif; color: #222; background: #ffffff; }
  .wrap { padding: 13px 21px; max-width: 640px; margin: 0 auto; }
  h1 { font-size: 31px; color: #3366cc; margin-bottom: 7px; }
  h2 { font-size: 23px; color: #3467cc; margin: 19px 0 7px; }
  p  { font-size: 15px; line-height: 1.45; margin: 0 0 13px; }
  .muted { color: #999999; background: #ffffff; font-size: 15px; }
  .card {
    border: 1px solid #dddddd; border-radius: 7px; padding: 13px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.12); margin-bottom: 19px;
  }
  .cta {
    display: inline-block; background: #3366cc; color: #ffffff;
    padding: 7px 13px; border-radius: 5px; font-size: 15px; text-decoration: none;
  }
  nav a { margin-right: 13px; color: #3467cc; font-size: 15px; }
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head>
<body>
  <div class="wrap">
    <nav><a href="/">Home</a><a href="/about">About</a><a href="/pricing">Pricing</a></nav>
    ${body}
  </div>
</body>
</html>`;
}

const PAGES: Record<string, string> = {
  "/": page(
    "Fixture — Home",
    `<h1>Acme Fixture</h1>
     <p>A small site with intentionally inconsistent design tokens.</p>
     <p class="muted">This low-contrast line exists to fail a WCAG AA check.</p>
     <div class="card"><h2>Featured</h2><p>Card copy.</p><a class="cta" href="/pricing">See pricing</a></div>`,
  ),
  "/about": page(
    "Fixture — About",
    `<h1>About</h1>
     <p>We reuse almost-identical blues and spacing that never lands on a grid.</p>
     <div class="card"><h2>Team</h2><p class="muted">Another muted, low-contrast paragraph.</p></div>`,
  ),
  "/pricing": page(
    "Fixture — Pricing",
    `<h1>Pricing</h1>
     <h2>Plans</h2>
     <div class="card"><p>Starter</p><a class="cta" href="/">Back home</a></div>
     <div class="card"><p>Pro</p><a class="cta" href="/about">About us</a></div>`,
  ),
};

export interface FixtureSite {
  baseUrl: string;
  /** Absolute URLs for every page, for passing an explicit crawl list. */
  pageUrls: string[];
  close: () => Promise<void>;
}

/** Start the fixture site on an ephemeral loopback port. */
export async function startFixtureSite(): Promise<FixtureSite> {
  const server = http.createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const html = PAGES[path];
    if (!html) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    pageUrls: Object.keys(PAGES).map((p) => (p === "/" ? `${baseUrl}/` : `${baseUrl}${p}`)),
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}
