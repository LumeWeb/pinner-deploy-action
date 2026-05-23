import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi
} from 'vite-plus/test'
import { server } from './setup.js'
import { HttpResponse, http } from 'msw'
import {
  getGetApiIpnsKeysMockHandler,
  getPostApiIpnsPublishMockHandler,
  getGetApiIpnsResolveNameMockHandler,
  getGetApiIpnsKeysIdMockHandler
} from '@lumeweb/pinner/mocks'
import {
  getGetApiWebsitesMockHandler,
  getPostApiWebsitesMockHandler,
  getPutApiWebsitesIdMockHandler
} from '@lumeweb/pinner/mocks'
import {
  getGetPinsMockHandler,
  getDeletePinsRequestidMockHandler
} from '@lumeweb/pinner/mocks'
import {
  initClient,
  resolveIpnsKey,
  publishIpns,
  setupWebsite,
  removePrevious
} from '@/pinner.js'

const TEST_JWT = 'test-jwt-token'
const TEST_ENDPOINT = 'https://ipfs.pinner.xyz'
const TEST_CID = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'

async function apiFetch(
  endpoint: string,
  path: string,
  jwt: string,
  options: RequestInit = {}
) {
  const url = `${endpoint}/${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined)
    }
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string
    }
    throw new Error(
      body.error || `HTTP error ${response.status}: ${response.statusText}`
    )
  }
  const text = await response.text()
  return text ? JSON.parse(text) : undefined
}

vi.mock('@lumeweb/pinner', () => {
  class IpnsClient {
    private endpoint: string
    private jwt: string

    constructor(config: { jwt: string; endpoint: string }) {
      this.jwt = config.jwt
      this.endpoint = config.endpoint
    }

    async listKeys() {
      return apiFetch(this.endpoint, 'api/ipns/keys', this.jwt)
    }

    async getKey(id: number) {
      return apiFetch(this.endpoint, `api/ipns/keys/${id}`, this.jwt)
    }

    async publish(request: { cid: string; key_id: number }) {
      return apiFetch(this.endpoint, 'api/ipns/publish', this.jwt, {
        method: 'POST',
        body: JSON.stringify(request)
      })
    }

    async resolve(name: string) {
      return apiFetch(this.endpoint, `api/ipns/resolve/${name}`, this.jwt)
    }
  }

  class WebsitesClient {
    private endpoint: string
    private jwt: string

    constructor(config: { jwt: string; endpoint: string }) {
      this.jwt = config.jwt
      this.endpoint = config.endpoint
    }

    async listWebsites() {
      return apiFetch(this.endpoint, 'api/websites', this.jwt)
    }

    async createWebsite(request: {
      domain: string
      target_hash: string
      target_type: string
    }) {
      return apiFetch(this.endpoint, 'api/websites', this.jwt, {
        method: 'POST',
        body: JSON.stringify(request)
      })
    }

    async updateWebsite(
      id: number,
      request: {
        domain: string
        target_hash: string
        target_type: string
      }
    ) {
      return apiFetch(this.endpoint, `api/websites/${id}`, this.jwt, {
        method: 'PUT',
        body: JSON.stringify(request)
      })
    }
  }

  class Pinner {
    ipns: IpnsClient
    websites: WebsitesClient
    private endpoint: string
    private jwt: string

    constructor(config: { jwt: string; endpoint: string }) {
      this.jwt = config.jwt
      this.endpoint = config.endpoint
      this.ipns = new IpnsClient(config)
      this.websites = new WebsitesClient(config)
    }

    async unpin(cid: string) {
      const listResponse = await apiFetch(
        this.endpoint,
        `pins?cid=${encodeURIComponent(cid)}`,
        this.jwt
      )
      const results = listResponse.results || []
      for (const result of results) {
        await fetch(`${this.endpoint}/pins/${result.requestid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${this.jwt}` }
        })
      }
    }
  }

  return { Pinner, IpnsClient, WebsitesClient }
})

function createPinner() {
  return initClient(TEST_JWT, TEST_ENDPOINT)
}

describe('Pinner wrapper integration', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())

  describe('resolveIpnsKey', () => {
    it('should return numeric key input directly', async () => {
      const pinner = createPinner()
      const result = await resolveIpnsKey(pinner, '42')
      expect(result).toBe(42)
    })

    it('should resolve named key to its numeric id', async () => {
      server.use(
        getGetApiIpnsKeysMockHandler({
          data: [
            {
              id: 1,
              name: 'my-app-key',
              ipns_name: 'k51qzi5qu...',
              peer_id: '12D3Koo...',
              created: '2025-01-01T00:00:00Z'
            }
          ],
          total: 1
        })
      )

      const pinner = createPinner()
      const result = await resolveIpnsKey(pinner, 'my-app-key')
      expect(result).toBe(1)
    })

    it('should throw when key name is not found', async () => {
      server.use(
        getGetApiIpnsKeysMockHandler({
          data: [
            {
              id: 1,
              name: 'other-key',
              ipns_name: 'k51other...',
              peer_id: '12D3Other...',
              created: '2025-01-01T00:00:00Z'
            }
          ],
          total: 1
        })
      )

      const pinner = createPinner()
      await expect(resolveIpnsKey(pinner, 'nonexistent')).rejects.toThrow(
        'IPNS key not found for name "nonexistent"'
      )
    })
  })

  describe('publishIpns', () => {
    it('should publish CID to IPNS and return the IPNS name', async () => {
      server.use(
        getPostApiIpnsPublishMockHandler({
          name: 'k51qzi5quPublished',
          value: `/ipfs/${TEST_CID}`,
          sequence: 1,
          published: '2025-06-01T00:00:00Z',
          validity: '2026-06-01T00:00:00Z'
        })
      )

      const pinner = createPinner()
      const result = await publishIpns(pinner, TEST_CID, '7')
      expect(result).toBe('k51qzi5quPublished')
    })
  })

  describe('setupWebsite', () => {
    it('should create a new website when domain does not exist', async () => {
      server.use(
        getGetApiWebsitesMockHandler({ data: [], total: 0 }),
        getPostApiWebsitesMockHandler({
          id: 99,
          domain: 'new.example.com',
          target_hash: TEST_CID,
          target_type: 'ipfs',
          status: 'active',
          created: '2025-01-01T00:00:00Z',
          updated: '2025-01-01T00:00:00Z',
          expired: false,
          dns_hosting_enabled: false,
          is_subdomain: false,
          validation_token: 'tok_new123'
        })
      )

      const pinner = createPinner()
      const result = await setupWebsite(pinner, TEST_CID, 'new.example.com')
      expect(result).toBe('99')
    })

    it('should update existing website when domain matches', async () => {
      server.use(
        getGetApiWebsitesMockHandler({
          data: [
            {
              id: 42,
              domain: 'existing.example.com',
              target_hash: 'QmOldCID',
              target_type: 'ipfs',
              status: 'active',
              created: '2025-01-01T00:00:00Z',
              updated: '2025-01-01T00:00:00Z',
              expired: false,
              dns_hosting_enabled: false,
              is_subdomain: false,
              validation_token: 'tok_exist123'
            }
          ],
          total: 1
        }),
        getPutApiWebsitesIdMockHandler({
          id: 42,
          domain: 'existing.example.com',
          target_hash: TEST_CID,
          target_type: 'ipfs',
          status: 'active',
          created: '2025-01-01T00:00:00Z',
          updated: '2025-06-01T00:00:00Z',
          expired: false,
          dns_hosting_enabled: false,
          is_subdomain: false,
          validation_token: 'tok_exist123'
        })
      )

      const pinner = createPinner()
      const result = await setupWebsite(
        pinner,
        TEST_CID,
        'existing.example.com'
      )
      expect(result).toBe('42')
    })
  })

  describe('removePrevious', () => {
    it('should resolve IPNS record and unpin previous CID', async () => {
      server.use(
        getGetApiIpnsResolveNameMockHandler({
          name: 'k51resolve...',
          value: '/ipfs/QmOldCID',
          path: '/ipfs/QmOldCID',
          sequence: 3,
          expired: false,
          expires: '2026-01-01T00:00:00Z'
        }),
        getGetPinsMockHandler({
          count: 1,
          results: [
            {
              requestid: 'pin-old-1',
              status: 'pinned',
              created: '2025-01-01T00:00:00Z',
              delegates: [],
              pin: { cid: 'QmOldCID' }
            }
          ]
        }),
        getDeletePinsRequestidMockHandler(undefined)
      )

      const pinner = createPinner()
      await expect(
        removePrevious(pinner, 'QmNewCID', { ipnsKey: 'my-app' })
      ).resolves.toBeUndefined()
    })

    it('should complete without error when no previous record exists', async () => {
      // Generated handler only supports 200 status; raw http.get needed for 404
      server.use(
        http.get('*/api/ipns/resolve/:name', () => {
          return HttpResponse.json(
            { error: 'IPNS record not found' },
            { status: 404 }
          )
        })
      )

      const pinner = createPinner()
      await expect(
        removePrevious(pinner, 'QmNewCID', { ipnsKey: 'new-key' })
      ).resolves.toBeUndefined()
    })

    it('should lookup website by domain and unpin active_cid', async () => {
      server.use(
        getGetApiWebsitesMockHandler({
          data: [
            {
              id: 42,
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
          ],
          total: 1
        }),
        getGetPinsMockHandler({
          count: 1,
          results: [
            {
              requestid: 'pin-old-1',
              status: 'pinned',
              created: '2025-01-01T00:00:00Z',
              delegates: [],
              pin: { cid: 'QmOldCID' }
            }
          ]
        }),
        getDeletePinsRequestidMockHandler(undefined)
      )

      const pinner = createPinner()
      await expect(
        removePrevious(pinner, 'QmNewCID', { domain: 'app.example.com' })
      ).resolves.toBeUndefined()
    })

    it('should also resolve IPNS when website has ipns_key_id', async () => {
      server.use(
        getGetApiWebsitesMockHandler({
          data: [
            {
              id: 42,
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
          ],
          total: 1
        }),
        getGetApiIpnsKeysIdMockHandler({
          id: 5,
          name: 'app-key',
          ipns_name: 'k51qzi5qu...app',
          peer_id: '12D3Koo...app',
          created: '2025-01-01T00:00:00Z'
        }),
        getGetApiIpnsResolveNameMockHandler({
          name: 'k51qzi5qu...app',
          value: '/ipfs/QmOldIPNSCID',
          path: '/ipfs/QmOldIPNSCID',
          sequence: 2,
          expired: false,
          expires: '2026-01-01T00:00:00Z'
        }),
        getGetPinsMockHandler({
          count: 1,
          results: [
            {
              requestid: 'pin-old-1',
              status: 'pinned',
              created: '2025-01-01T00:00:00Z',
              delegates: [],
              pin: { cid: 'QmOldCID' }
            }
          ]
        }),
        getDeletePinsRequestidMockHandler(undefined)
      )

      const pinner = createPinner()
      await expect(
        removePrevious(pinner, 'QmNewCID', { domain: 'app.example.com' })
      ).resolves.toBeUndefined()
    })
  })
})
