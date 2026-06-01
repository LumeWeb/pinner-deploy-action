import { File } from 'node:buffer'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Pinner } from '@lumeweb/pinner'
import type { UploadResult } from '@lumeweb/pinner'

export interface DeployOptions {
  apiKey: string
  endpoint: string
  path?: string
  cid?: string
  ipnsKey?: string
  domain?: string
  removePrevious: boolean
}

export interface DeployResult {
  cid: string
  gatewayUrl: string
  ipnsName?: string
  websiteId?: string
}

export function initClient(apiKey: string, endpoint: string): Pinner {
  return new Pinner({ jwt: apiKey, endpoint })
}

export async function uploadPath(
  pinner: Pinner,
  inputPath: string
): Promise<string> {
  const stat = fs.statSync(inputPath)

  if (stat.isFile()) {
    const buffer = fs.readFileSync(inputPath)
    const file = new File([buffer], path.basename(inputPath))
    const result: UploadResult = await pinner.uploadAndWait(file, {
      name: path.basename(inputPath)
    })
    return result.cid
  }

  if (stat.isDirectory()) {
    const files = readDirAsFiles(inputPath)
    const operation = await pinner.uploadDirectory(files, {
      name: path.basename(inputPath)
    })
    const result: UploadResult = await operation.result
    return result.cid
  }

  throw new Error(`Path is neither a file nor directory: ${inputPath}`)
}

export async function pinByCid(pinner: Pinner, cid: string): Promise<string> {
  const gen = await pinner.pinByHash(cid)
  for await (const resultCid of gen) {
    return resultCid.toString()
  }
  console.warn(
    `pinByHash yielded no results for CID ${cid}, returning input CID as fallback`
  )
  return cid
}

export async function resolveIpnsKey(
  pinner: Pinner,
  keyInput: string,
  signal?: AbortSignal
): Promise<number> {
  const parsed = parseInt(keyInput, 10)
  if (!isNaN(parsed) && String(parsed) === keyInput) {
    return parsed
  }

  const response = await pinner.ipns.listKeys({ signal })
  const keys = Array.isArray(response.data) ? response.data : [response.data]
  const match = keys.find(
    (k: { id: number; name: string }) => k.name === keyInput
  )
  if (!match) {
    throw new Error(`IPNS key not found for name "${keyInput}"`)
  }
  return match.id
}

export async function publishIpns(
  pinner: Pinner,
  cid: string,
  keyInput: string,
  signal?: AbortSignal
): Promise<string> {
  const keyId = await resolveIpnsKey(pinner, keyInput, signal)
  const result = await pinner.ipns.publish({ cid, key_id: keyId }, { signal })
  return result.name || keyInput
}

export async function setupWebsite(
  pinner: Pinner,
  cid: string,
  domain: string
): Promise<string> {
  const response = await pinner.websites.listWebsites()
  const items = Array.isArray(response.data) ? response.data : [response.data]
  const existing = items.find((w: { domain: string }) => w.domain === domain)

  if (existing) {
    await pinner.websites.updateWebsite(existing.id, {
      domain,
      target_hash: cid,
      target_type: 'ipfs'
    })
    return String(existing.id)
  }

  const website = await pinner.websites.createWebsite({
    domain,
    target_hash: cid,
    target_type: 'ipfs'
  })
  return String(website.id)
}

export interface RemovePreviousOptions {
  ipnsKey?: string
  domain?: string
  signal?: AbortSignal
}

const CLEANUP_TIMEOUT_MS = 30_000

function cleanupAbortSignal(external?: AbortSignal): AbortSignal {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), CLEANUP_TIMEOUT_MS)

  if (external) {
    if (external.aborted) {
      clearTimeout(timeoutId)
      controller.abort()
      return controller.signal
    }
    external.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId)
        controller.abort()
      },
      { once: true }
    )
  }

  controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), {
    once: true
  })

  return controller.signal
}

export async function removePrevious(
  pinner: Pinner,
  newCid: string,
  options: RemovePreviousOptions
): Promise<void> {
  const signal = cleanupAbortSignal(options.signal)

  if (options.domain) {
    try {
      const response = await pinner.websites.listWebsites({ signal })
      const items = Array.isArray(response.data)
        ? response.data
        : [response.data]
      const existing = items.find(
        (w: { domain: string }) => w.domain === options.domain
      )

      if (existing) {
        // active_cid is the IPNS-published CID (populated from the key's
        // LastPublishedCID by the backend). ipns.resolve() just returns the
        // same value through a more expensive datastore/DHT code path.
        const activeCid = existing.active_cid
        if (activeCid && activeCid !== newCid) {
          await pinner.unpin(activeCid, { signal })
        }
      }
    } catch (err) {
      console.warn(
        'Failed to remove previous pin for domain:',
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  if (options.ipnsKey) {
    try {
      // Read the key's stored value instead of calling ipns.resolve().
      // resolve() hits the datastore or DHT and can hang; the key's
      // value field is updated synchronously on every publish.
      const keyId = await resolveIpnsKey(pinner, options.ipnsKey)
      const key = await pinner.ipns.getKey(keyId, { signal })
      if (key.value && key.value !== newCid) {
        await pinner.unpin(key.value, { signal })
      }
    } catch (err) {
      console.warn(
        'Failed to remove previous pin for IPNS key:',
        err instanceof Error ? err.message : String(err)
      )
    }
  }
}

function readDirAsFiles(rootDir: string, currentDir?: string): File[] {
  const files: File[] = []
  const scanDir = currentDir ?? rootDir
  const entries = fs.readdirSync(scanDir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(scanDir, entry.name)
    if (entry.isFile()) {
      const buffer = fs.readFileSync(fullPath)
      const relativePath = path.relative(rootDir, fullPath)
      files.push(new File([buffer], relativePath))
    } else if (entry.isDirectory()) {
      files.push(...readDirAsFiles(rootDir, fullPath))
    }
  }

  return files
}
