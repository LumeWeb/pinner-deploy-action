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
