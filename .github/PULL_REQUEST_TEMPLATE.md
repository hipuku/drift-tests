## What changed

<!-- What the suite checks now that it did not before. One short paragraph. -->

## Why

<!-- The problem, or the issue it closes: "Closes #12". -->

## How it was tested

<!-- The Drift version the suite ran against, and anything checked by hand. -->

## Checklist

- [ ] `npm run lint && npm run lint:prose && npm run typecheck && npm test` passes against a running Drift
- [ ] A scenario that fails without this change, for a new check
- [ ] `npm run generate` rerun, if Drift's `openapi.yaml` changed
- [ ] README or DESIGN updated, if what the suite covers changed
