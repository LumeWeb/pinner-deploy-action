## 0.1.22 (2026-07-08)

### Fixes

- stub native .node addons in post-build script
- add construct trap to Proxy stub and fix regex prefix

## 0.1.21 (2026-07-08)

### Fixes

- run post-build inline script in release workflow

## 0.1.20 (2026-07-08)

### Fixes

- inline package.json requires via post-build script

## 0.1.19 (2026-07-08)

### Fixes

- disable treeshake to produce non-empty dist/index.js
- use rm -rf instead of npx rimraf in check-dist workflow

## 0.1.18 (2026-07-05)

### Fixes

- stub native addon (.node) requires to prevent crash on import

## 0.1.17 (2026-07-05)

### Fixes

- use renderChunk instead of transform for createRequire inlining
- Fix createRequire package.json inlining by using renderChunk instead of
  transform hook

## 0.1.16 (2026-07-04)

### Fixes

- inline createRequire package.json calls in bundle
- resolve package.json from module location, not fixed node_modules path

## 0.1.15 (2026-07-04)

### Features

- add timeout input for pin operation polling

### Fixes

- validate timeout input to prevent NaN reaching waitForOperation

## 0.1.14 (2026-06-22)

### Fixes

- bump @lumeweb/pinner to ^0.1.17

## 0.1.13 (2026-06-22)

### Fixes

- bump @lumeweb/pinner to ^0.1.16

## 0.1.12 (2026-06-22)

### Fixes

- bump @lumeweb/pinner to ^0.1.15

## 0.1.11 (2026-06-22)

### Fixes

- bump @lumeweb/pinner to ^0.1.14
- bump @lumeweb/pinner to ^0.1.14

## 0.1.10 (2026-06-21)

### Fixes

- wait for pin operation to settle before returning CID

## 0.1.9 (2026-06-10)

### Fixes

- upgrade @lumeweb/pinner to 0.1.13

## 0.1.8 (2026-06-01)

### Fixes

- upgrade @lumeweb/pinner to 0.1.11 for correct directory upload root CID

## 0.1.7 (2026-06-01)

### Fixes

- resolve action hang, double execution, and [object Response] error
- preserve exit code set by core.setFailed() in process.exit()

## 0.1.6 (2026-06-01)

### Fixes

- remove ipns.resolve() and add 30s abort timeout to cleanup
- pass abort signal to resolveIpnsKey in ipnsKey cleanup path

## 0.1.5 (2026-06-01)

### Fixes

- bump @lumeweb/pinner to 0.1.10 for upload response parsing fix

## 0.1.4 (2026-06-01)

### Fixes

- upgrade to node24, pinner 0.1.9, add semver tag sync

## 0.1.3 (2026-05-23)

### Features

- refactor remove-previous to work with domain or IPNS key

### Fixes

- run both domain and IPNS cleanup paths when both options are provided

## 0.1.2 (2026-05-22)

### Features

- pinner-deploy-action

## 0.1.1 (2026-05-22)

### Features

- pinner-deploy-action
