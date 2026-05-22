import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'
import type { Mock } from 'vite-plus/test'

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
    pinByHash: vi.fn(),
    ipns: {
      publish: vi.fn().mockResolvedValue({ name: 'k51qzi5qu...test' }),
      resolve: vi.fn().mockResolvedValue({ value: '/ipfs/QmOldCID' }),
      listKeys: vi
        .fn()
        .mockResolvedValue({ data: [{ id: 1, name: 'test-key' }] })
    },
    websites: {
      listWebsites: vi.fn().mockResolvedValue({ data: [] }),
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
      expect(mockPinner.ipns.publish).toHaveBeenCalledWith({
        cid: 'QmTestCID',
        key_id: 1
      })
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
    it('should resolve IPNS and unpin old CID', async () => {
      mockPinner.ipns.resolve.mockResolvedValue({ value: '/ipfs/QmOldCID' })

      await removePrevious(mockPinner as any, 'test-key')
      expect(mockPinner.ipns.resolve).toHaveBeenCalledWith('test-key')
      expect(mockPinner.unpin).toHaveBeenCalledWith('QmOldCID')
    })

    it('should not fail if no previous record exists', async () => {
      mockPinner.ipns.resolve.mockRejectedValue(new Error('not found'))

      await expect(
        removePrevious(mockPinner as any, 'test-key')
      ).resolves.toBeUndefined()
    })

    it('should not unpin if resolve returns no value', async () => {
      mockPinner.ipns.resolve.mockResolvedValue({ value: null })

      await removePrevious(mockPinner as any, 'test-key')
      expect(mockPinner.unpin).not.toHaveBeenCalled()
    })
  })
})
