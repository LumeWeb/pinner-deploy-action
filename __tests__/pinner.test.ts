import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'
import type { Mock } from 'vite-plus/test'
import * as core from '../__fixtures__/core.js'

vi.mock('@actions/core', () => core)

vi.mock('node:fs', () => ({
  statSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn()
}))

vi.mock('node:buffer', () => ({
  File: class MockFile {
    bits: any
    name: string
    constructor(bits: any, name: string) {
      this.bits = bits
      this.name = name
    }
  }
}))

vi.mock('@lumeweb/pinner', () => ({
  Pinner: vi.fn()
}))

import { statSync, readFileSync, readdirSync } from 'node:fs'
import {
  uploadPath,
  pinByCid,
  resolveIpnsKey,
  publishIpns,
  setupWebsite,
  removePrevious
} from '@/pinner.js'

const mockStatSync = statSync as Mock
const mockReadFileSync = readFileSync as Mock
const mockReaddirSync = readdirSync as Mock

function createMockPinner() {
  return {
    uploadAndWait: vi.fn().mockResolvedValue({
      cid: 'QmTestCID',
      name: 'test',
      size: 1024,
      operationId: 'op-1'
    }),
    uploadDirectory: vi.fn().mockReturnValue({
      result: Promise.resolve({
        cid: 'QmTestCID',
        name: 'test',
        size: 1024,
        operationId: 'op-1'
      })
    }),
    waitForOperation: vi.fn().mockResolvedValue({
      cid: 'QmTestCID',
      name: 'test',
      size: 1024,
      operationId: 'op-1'
    }),
    pinByHash: vi.fn(),
    ipns: {
      publish: vi.fn().mockResolvedValue({ name: 'k51qzi5qu...test' }),
      listKeys: vi
        .fn()
        .mockResolvedValue({ data: [{ id: 1, name: 'test-key' }] }),
      getKey: vi.fn().mockResolvedValue({
        id: 1,
        name: 'test-key',
        ipns_name: 'k51qzi5qu...test',
        peer_id: '12D3Koo...test',
        value: 'QmOldCID',
        created: '2025-01-01T00:00:00Z'
      })
    },
    websites: {
      listWebsites: vi.fn().mockResolvedValue({ data: [] }),
      getWebsite: vi.fn().mockResolvedValue({
        id: 1,
        domain: 'test.example.com',
        active_cid: 'QmOldCID',
        ipns_key_id: 1,
        target_hash: 'QmOldCID',
        target_type: 'ipfs',
        status: 'active',
        created: '2025-01-01T00:00:00Z',
        updated: '2025-01-01T00:00:00Z',
        expired: false,
        dns_hosting_enabled: false,
        is_subdomain: false,
        validation_token: 'tok123'
      }),
      createWebsite: vi
        .fn()
        .mockResolvedValue({ id: 'ws-1', domain: 'test.example.com' }),
      updateWebsite: vi
        .fn()
        .mockResolvedValue({ id: 'ws-1', domain: 'test.example.com' })
    },
    unpin: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn()
  }
}

describe('pinner wrapper', () => {
  let mockPinner: ReturnType<typeof createMockPinner>

  beforeEach(() => {
    vi.clearAllMocks()
    mockPinner = createMockPinner()
  })

  describe('uploadPath', () => {
    it('should upload a single file', async () => {
      mockStatSync.mockReturnValue({
        isFile: () => true,
        isDirectory: () => false
      })
      mockReadFileSync.mockReturnValue(Buffer.from('test'))

      const cid = await uploadPath(mockPinner as any, '/path/to/file.txt')
      expect(cid).toBe('QmTestCID')
      expect(mockPinner.uploadAndWait).toHaveBeenCalled()
    })

    it('should upload a directory', async () => {
      mockStatSync.mockReturnValue({
        isFile: () => false,
        isDirectory: () => true
      })
      mockReaddirSync.mockReturnValue([
        { name: 'index.html', isFile: () => true, isDirectory: () => false }
      ])
      mockReadFileSync.mockReturnValue(Buffer.from('<html>test</html>'))

      const cid = await uploadPath(mockPinner as any, '/path/to/dir')
      expect(cid).toBe('QmTestCID')
      expect(mockPinner.uploadDirectory).toHaveBeenCalled()
    })

    it('should call waitForOperation after directory upload before returning CID', async () => {
      mockStatSync.mockReturnValue({
        isFile: () => false,
        isDirectory: () => true
      })
      mockReaddirSync.mockReturnValue([
        { name: 'index.html', isFile: () => true, isDirectory: () => false }
      ])
      mockReadFileSync.mockReturnValue(Buffer.from('<html>test</html>'))

      mockPinner.uploadDirectory.mockReturnValue({
        result: Promise.resolve({
          cid: 'QmDirCID',
          name: 'dir',
          size: 2048,
          operationId: 'op-2'
        })
      })
      mockPinner.waitForOperation.mockResolvedValue({
        cid: 'QmDirCID',
        name: 'dir',
        size: 2048,
        operationId: 'op-2'
      })

      const cid = await uploadPath(mockPinner as any, '/path/to/dir')
      expect(cid).toBe('QmDirCID')
      expect(mockPinner.waitForOperation).toHaveBeenCalledWith(
        expect.objectContaining({ cid: 'QmDirCID', operationId: 'op-2' }),
        { timeout: undefined }
      )
    })

    it('should pass timeout to waitForOperation when provided', async () => {
      mockStatSync.mockReturnValue({
        isFile: () => false,
        isDirectory: () => true
      })
      mockReaddirSync.mockReturnValue([
        { name: 'index.html', isFile: () => true, isDirectory: () => false }
      ])
      mockReadFileSync.mockReturnValue(Buffer.from('<html>test</html>'))

      mockPinner.uploadDirectory.mockReturnValue({
        result: Promise.resolve({
          cid: 'QmDirCID',
          name: 'dir',
          size: 2048,
          operationId: 'op-2'
        })
      })
      mockPinner.waitForOperation.mockResolvedValue({
        cid: 'QmDirCID',
        name: 'dir',
        size: 2048,
        operationId: 'op-2'
      })

      await uploadPath(mockPinner as any, '/path/to/dir', 600000)
      expect(mockPinner.waitForOperation).toHaveBeenCalledWith(
        expect.objectContaining({ cid: 'QmDirCID', operationId: 'op-2' }),
        { timeout: 600000 }
      )
    })

    it('should throw if waitForOperation returns a result without a CID', async () => {
      mockStatSync.mockReturnValue({
        isFile: () => false,
        isDirectory: () => true
      })
      mockReaddirSync.mockReturnValue([
        { name: 'index.html', isFile: () => true, isDirectory: () => false }
      ])
      mockReadFileSync.mockReturnValue(Buffer.from('<html>test</html>'))

      mockPinner.uploadDirectory.mockReturnValue({
        result: Promise.resolve({
          cid: 'QmDirCID',
          name: 'dir',
          size: 2048,
          operationId: 'op-3'
        })
      })
      mockPinner.waitForOperation.mockResolvedValue({
        cid: undefined,
        name: 'dir',
        size: 2048,
        operationId: 'op-3'
      })

      await expect(
        uploadPath(mockPinner as any, '/path/to/dir')
      ).rejects.toThrow('CID is not available')
    })

    it('should throw if file upload result has no CID', async () => {
      mockStatSync.mockReturnValue({
        isFile: () => true,
        isDirectory: () => false
      })
      mockReadFileSync.mockReturnValue(Buffer.from('test'))
      mockPinner.uploadAndWait.mockResolvedValue({
        cid: undefined,
        name: 'test',
        size: 1024,
        operationId: 'op-4'
      })

      await expect(
        uploadPath(mockPinner as any, '/path/to/file.txt')
      ).rejects.toThrow('CID is not available')
    })

    it('should throw for non-file non-directory paths', async () => {
      mockStatSync.mockReturnValue({
        isFile: () => false,
        isDirectory: () => false
      })

      await expect(uploadPath(mockPinner as any, '/dev/null')).rejects.toThrow(
        'neither a file nor directory'
      )
    })
  })

  describe('pinByCid', () => {
    it('should pin an existing CID', async () => {
      const asyncGen = (async function* () {
        yield 'QmTargetCID'
      })()
      mockPinner.pinByHash.mockReturnValue(asyncGen)

      const cid = await pinByCid(mockPinner as any, 'QmTargetCID')
      expect(cid).toBe('QmTargetCID')
    })

    it('should return the input CID if generator is empty', async () => {
      const asyncGen = (async function* () {
        /* empty */
      })()
      mockPinner.pinByHash.mockReturnValue(asyncGen)

      const cid = await pinByCid(mockPinner as any, 'QmInputCID')
      expect(cid).toBe('QmInputCID')
    })
  })

  describe('resolveIpnsKey', () => {
    it('should return numeric input directly without calling listKeys', async () => {
      const result = await resolveIpnsKey(mockPinner as any, '42')
      expect(result).toBe(42)
      expect(mockPinner.ipns.listKeys).not.toHaveBeenCalled()
    })

    it('should resolve name to key id via listKeys', async () => {
      mockPinner.ipns.listKeys.mockResolvedValue({
        data: [{ id: 1, name: 'my-app' }]
      })

      const result = await resolveIpnsKey(mockPinner as any, 'my-app')
      expect(result).toBe(1)
      expect(mockPinner.ipns.listKeys).toHaveBeenCalled()
    })

    it('should throw when name is not found', async () => {
      mockPinner.ipns.listKeys.mockResolvedValue({ data: [] })

      await expect(
        resolveIpnsKey(mockPinner as any, 'nonexistent')
      ).rejects.toThrow('IPNS key not found for name "nonexistent"')
    })
  })

  describe('publishIpns', () => {
    it('should publish CID to IPNS', async () => {
      mockPinner.ipns.listKeys.mockResolvedValue({
        data: [{ id: 1, name: 'test-key-id' }]
      })

      const name = await publishIpns(
        mockPinner as any,
        'QmTestCID',
        'test-key-id'
      )
      expect(name).toBe('k51qzi5qu...test')
      expect(mockPinner.ipns.publish).toHaveBeenCalledWith(
        { cid: 'QmTestCID', key_id: 1 },
        { signal: undefined }
      )
    })

    it('should return keyInput when publish returns no name', async () => {
      mockPinner.ipns.listKeys.mockResolvedValue({
        data: [{ id: 2, name: 'fallback-key' }]
      })
      mockPinner.ipns.publish.mockResolvedValue({ name: null })

      const name = await publishIpns(
        mockPinner as any,
        'QmTestCID',
        'fallback-key'
      )
      expect(name).toBe('fallback-key')
    })
  })

  describe('setupWebsite', () => {
    it('should create a new website when domain does not exist', async () => {
      const id = await setupWebsite(
        mockPinner as any,
        'QmTestCID',
        'new.example.com'
      )
      expect(id).toBe('ws-1')
      expect(mockPinner.websites.createWebsite).toHaveBeenCalledWith({
        domain: 'new.example.com',
        target_hash: 'QmTestCID',
        target_type: 'ipfs'
      })
    })

    it('should update existing website when domain exists', async () => {
      mockPinner.websites.listWebsites.mockResolvedValue({
        data: [
          {
            id: 'existing-ws',
            domain: 'test.example.com',
            target_hash: 'QmOldCID',
            target_type: 'ipfs'
          }
        ]
      })

      const id = await setupWebsite(
        mockPinner as any,
        'QmTestCID',
        'test.example.com'
      )
      expect(id).toBe('existing-ws')
      expect(mockPinner.websites.updateWebsite).toHaveBeenCalledWith(
        'existing-ws',
        {
          domain: 'test.example.com',
          target_hash: 'QmTestCID',
          target_type: 'ipfs'
        }
      )
    })
  })

  describe('removePrevious', () => {
    it('should unpin old CID via IPNS key record when ipnsKey provided', async () => {
      mockPinner.ipns.getKey.mockResolvedValue({
        id: 1,
        name: 'test-key',
        ipns_name: 'k51qzi5qu...test',
        peer_id: '12D3Koo...test',
        value: 'QmOldCID',
        created: '2025-01-01T00:00:00Z'
      })

      await removePrevious(mockPinner as any, 'QmNewCID', {
        ipnsKey: 'test-key'
      })
      expect(mockPinner.ipns.getKey).toHaveBeenCalledWith(1, {
        signal: expect.any(AbortSignal)
      })
      expect(mockPinner.unpin).toHaveBeenCalledWith('QmOldCID', {
        signal: expect.any(AbortSignal)
      })
    })

    it('should not unpin if key value matches newCid', async () => {
      mockPinner.ipns.getKey.mockResolvedValue({
        id: 1,
        name: 'test-key',
        ipns_name: 'k51qzi5qu...test',
        peer_id: '12D3Koo...test',
        value: 'QmNewCID',
        created: '2025-01-01T00:00:00Z'
      })

      await removePrevious(mockPinner as any, 'QmNewCID', {
        ipnsKey: 'test-key'
      })
      expect(mockPinner.unpin).not.toHaveBeenCalled()
    })

    it('should not fail if getKey returns no value', async () => {
      mockPinner.ipns.getKey.mockResolvedValue({
        id: 1,
        name: 'test-key',
        ipns_name: 'k51qzi5qu...test',
        peer_id: '12D3Koo...test',
        value: undefined,
        created: '2025-01-01T00:00:00Z'
      })

      await expect(
        removePrevious(mockPinner as any, 'QmNewCID', {
          ipnsKey: 'test-key'
        })
      ).resolves.toBeUndefined()
      expect(mockPinner.unpin).not.toHaveBeenCalled()
    })

    it('should warn on IPNS key lookup failure instead of throwing', async () => {
      mockPinner.ipns.getKey.mockRejectedValue(new Error('not found'))
      const warnSpy = vi.spyOn(core, 'warning').mockImplementation(() => {})

      await expect(
        removePrevious(mockPinner as any, 'QmNewCID', {
          ipnsKey: 'test-key'
        })
      ).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should lookup website by domain and unpin active_cid', async () => {
      mockPinner.websites.listWebsites.mockResolvedValue({
        data: [
          {
            id: 1,
            domain: 'app.example.com',
            active_cid: 'QmOldCID',
            ipns_key_id: undefined,
            target_hash: 'QmOldCID',
            target_type: 'ipfs',
            status: 'active',
            created: '2025-01-01T00:00:00Z',
            updated: '2025-01-01T00:00:00Z',
            expired: false,
            dns_hosting_enabled: false,
            is_subdomain: false,
            validation_token: 'tok123'
          }
        ]
      })

      await removePrevious(mockPinner as any, 'QmNewCID', {
        domain: 'app.example.com'
      })
      expect(mockPinner.websites.listWebsites).toHaveBeenCalledWith({
        signal: expect.any(AbortSignal)
      })
      expect(mockPinner.unpin).toHaveBeenCalledWith('QmOldCID', {
        signal: expect.any(AbortSignal)
      })
    })

    it('should skip unpin if active_cid matches newCid', async () => {
      mockPinner.websites.listWebsites.mockResolvedValue({
        data: [
          {
            id: 1,
            domain: 'app.example.com',
            active_cid: 'QmNewCID',
            ipns_key_id: undefined,
            target_hash: 'QmNewCID',
            target_type: 'ipfs',
            status: 'active',
            created: '2025-01-01T00:00:00Z',
            updated: '2025-01-01T00:00:00Z',
            expired: false,
            dns_hosting_enabled: false,
            is_subdomain: false,
            validation_token: 'tok123'
          }
        ]
      })

      await removePrevious(mockPinner as any, 'QmNewCID', {
        domain: 'app.example.com'
      })
      expect(mockPinner.unpin).not.toHaveBeenCalled()
    })

    it('should use active_cid from website record (no separate IPNS resolution)', async () => {
      mockPinner.websites.listWebsites.mockResolvedValue({
        data: [
          {
            id: 1,
            domain: 'app.example.com',
            active_cid: 'QmOldCID',
            ipns_key_id: 5,
            target_hash: 'QmOldCID',
            target_type: 'ipfs',
            status: 'active',
            created: '2025-01-01T00:00:00Z',
            updated: '2025-01-01T00:00:00Z',
            expired: false,
            dns_hosting_enabled: false,
            is_subdomain: false,
            validation_token: 'tok123'
          }
        ]
      })

      await removePrevious(mockPinner as any, 'QmNewCID', {
        domain: 'app.example.com'
      })
      expect(mockPinner.unpin).toHaveBeenCalledWith('QmOldCID', {
        signal: expect.any(AbortSignal)
      })
      // active_cid already has the IPNS-published CID — no need for separate IPNS resolution
      expect(mockPinner.ipns.getKey).not.toHaveBeenCalled()
    })

    it('should do nothing when no domain and no ipnsKey provided', async () => {
      await removePrevious(mockPinner as any, 'QmNewCID', {})
      expect(mockPinner.unpin).not.toHaveBeenCalled()
      expect(mockPinner.websites.listWebsites).not.toHaveBeenCalled()
    })

    it('should warn on domain lookup failure instead of throwing', async () => {
      mockPinner.websites.listWebsites.mockRejectedValue(
        new Error('network error')
      )
      const warnSpy = vi.spyOn(core, 'warning').mockImplementation(() => {})

      await expect(
        removePrevious(mockPinner as any, 'QmNewCID', {
          domain: 'app.example.com'
        })
      ).resolves.toBeUndefined()
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })
  })
})
