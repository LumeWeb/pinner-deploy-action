# Pinner Deploy Action

Deploy content to IPFS via [Pinner](https://pinner.xyz) in your GitHub Actions
workflows.

## Usage

### Upload a directory

```yaml
- uses: lumeweb/pinner-deploy-action@v0
  with:
    api-key: ${{ secrets.PINNER_API_KEY }}
    path: ./dist
```

### Upload + IPNS publish

```yaml
- uses: lumeweb/pinner-deploy-action@v0
  with:
    api-key: ${{ secrets.PINNER_API_KEY }}
    path: ./build
    ipns-key: my-app
```

### Full deployment with domain + cleanup

```yaml
- uses: lumeweb/pinner-deploy-action@v0
  with:
    api-key: ${{ secrets.PINNER_API_KEY }}
    path: ./build
    ipns-key: my-app
    domain: myapp.example.com
    remove-previous: true
```

### Pin an existing CID

```yaml
- uses: lumeweb/pinner-deploy-action@v0
  with:
    api-key: ${{ secrets.PINNER_API_KEY }}
    cid: QmExampleCID...
```

## Inputs

| Input             | Required | Default                   | Description                                 |
| ----------------- | -------- | ------------------------- | ------------------------------------------- |
| `api-key`         | Yes      | —                         | Pinner API key                              |
| `path`            | No       | —                         | Local directory or file to upload to IPFS   |
| `cid`             | No       | —                         | Existing CID to pin (skip upload)           |
| `endpoint`        | No       | `https://ipfs.pinner.xyz` | Pinner API endpoint                         |
| `ipns-key`        | No       | —                         | IPNS key name or ID to publish under        |
| `domain`          | No       | —                         | Domain for gateway website setup            |
| `remove-previous` | No       | `false`                   | Remove previous pin after successful deploy |

> Either `path` or `cid` must be provided.

## Outputs

| Output        | Description                        |
| ------------- | ---------------------------------- |
| `cid`         | CID of the uploaded/pinned content |
| `gateway-url` | Gateway URL for the content        |
| `ipns-name`   | IPNS name if `ipns-key` was set    |
| `website-id`  | Website ID if `domain` was set     |
