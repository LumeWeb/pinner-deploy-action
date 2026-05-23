import { vi, describe, it, expect, beforeEach } from 'vite-plus/test'
import * as core from '../__fixtures__/core.js'

vi.mock('@actions/core', () => core)

const mockPinnerFns = {
  initClient: vi.fn(),
  uploadPath: vi.fn(),
  pinByCid: vi.fn(),
  publishIpns: vi.fn(),
  setupWebsite: vi.fn(),
  removePrevious: vi.fn()
}

vi.mock('../src/pinner.js', () => mockPinnerFns)

const { run } = await import('../src/main.js')

function mockInputs(inputs: Record<string, string>) {
  core.getInput.mockImplementation((name: string) => {
    if (name in inputs) return inputs[name]
    return ''
  })
}

describe('main action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail if api-key is missing', async () => {
    core.getInput.mockImplementation((name: string) => {
      if (name === 'api-key')
        throw new Error('Input required and not supplied: api-key')
      return ''
    })
    mockPinnerFns.initClient.mockResolvedValue({})

    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      'Input required and not supplied: api-key'
    )
  })

  it('should fail if neither path nor cid is provided', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: '',
      cid: '',
      endpoint: 'https://ipfs.pinner.xyz'
    })
    mockPinnerFns.initClient.mockReturnValue({})

    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      'Either "path" or "cid" input must be provided'
    )
  })

  it('should fail if remove-previous is set without ipns-key or domain', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: './dist',
      cid: '',
      endpoint: 'https://ipfs.pinner.xyz',
      'ipns-key': '',
      domain: '',
      'remove-previous': 'true'
    })
    mockPinnerFns.initClient.mockReturnValue({})

    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      '"remove-previous" requires "ipns-key" or "domain" to identify the old pin'
    )
  })

  it('should upload path and set outputs', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: './dist',
      cid: '',
      endpoint: 'https://ipfs.pinner.xyz',
      'ipns-key': '',
      domain: '',
      'remove-previous': 'false'
    })
    mockPinnerFns.initClient.mockReturnValue({})
    mockPinnerFns.uploadPath.mockResolvedValue('QmTestCID')

    await run()

    expect(mockPinnerFns.uploadPath).toHaveBeenCalled()
    expect(core.setOutput).toHaveBeenCalledWith('cid', 'QmTestCID')
    expect(core.setOutput).toHaveBeenCalledWith(
      'gateway-url',
      'https://dweb.link/ipfs/QmTestCID'
    )
  })

  it('should pin existing CID and set outputs', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: '',
      cid: 'QmExistingCID',
      endpoint: 'https://ipfs.pinner.xyz',
      'ipns-key': '',
      domain: '',
      'remove-previous': 'false'
    })
    mockPinnerFns.initClient.mockReturnValue({})
    mockPinnerFns.pinByCid.mockResolvedValue('QmExistingCID')

    await run()

    expect(mockPinnerFns.pinByCid).toHaveBeenCalledWith(
      expect.anything(),
      'QmExistingCID'
    )
    expect(core.setOutput).toHaveBeenCalledWith('cid', 'QmExistingCID')
  })

  it('should upload, publish IPNS, and set up website', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: './build',
      cid: '',
      endpoint: 'https://ipfs.pinner.xyz',
      'ipns-key': 'my-app-key',
      domain: 'app.example.com',
      'remove-previous': 'true'
    })
    mockPinnerFns.initClient.mockReturnValue({})
    mockPinnerFns.uploadPath.mockResolvedValue('QmTestCID')
    mockPinnerFns.publishIpns.mockResolvedValue('k51qzi5qu...test')
    mockPinnerFns.setupWebsite.mockResolvedValue('ws-1')

    await run()

    expect(mockPinnerFns.removePrevious).toHaveBeenCalledWith(
      expect.anything(),
      'QmTestCID',
      { ipnsKey: 'my-app-key', domain: 'app.example.com' }
    )
    expect(mockPinnerFns.uploadPath).toHaveBeenCalled()
    expect(mockPinnerFns.publishIpns).toHaveBeenCalledWith(
      expect.anything(),
      'QmTestCID',
      'my-app-key'
    )
    expect(mockPinnerFns.setupWebsite).toHaveBeenCalledWith(
      expect.anything(),
      'QmTestCID',
      'app.example.com'
    )
    expect(core.setOutput).toHaveBeenCalledWith('cid', 'QmTestCID')
    expect(core.setOutput).toHaveBeenCalledWith('ipns-name', 'k51qzi5qu...test')
    expect(core.setOutput).toHaveBeenCalledWith('website-id', 'ws-1')
  })

  it('should call removePrevious with domain only when no ipns-key', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: './build',
      cid: '',
      endpoint: 'https://ipfs.pinner.xyz',
      'ipns-key': '',
      domain: 'app.example.com',
      'remove-previous': 'true'
    })
    mockPinnerFns.initClient.mockReturnValue({})
    mockPinnerFns.uploadPath.mockResolvedValue('QmTestCID')
    mockPinnerFns.setupWebsite.mockResolvedValue('ws-1')

    await run()

    expect(mockPinnerFns.removePrevious).toHaveBeenCalledWith(
      expect.anything(),
      'QmTestCID',
      { ipnsKey: '', domain: 'app.example.com' }
    )
  })

  it('should use custom endpoint when provided', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: './dist',
      cid: '',
      endpoint: 'https://custom.pinner.example.com',
      'ipns-key': '',
      domain: '',
      'remove-previous': 'false'
    })
    mockPinnerFns.initClient.mockReturnValue({})
    mockPinnerFns.uploadPath.mockResolvedValue('QmTestCID')

    await run()

    expect(mockPinnerFns.initClient).toHaveBeenCalledWith(
      'test-key',
      'https://custom.pinner.example.com'
    )
  })

  it('should default endpoint to https://ipfs.pinner.xyz', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: './dist',
      cid: '',
      endpoint: '',
      'ipns-key': '',
      domain: '',
      'remove-previous': 'false'
    })
    mockPinnerFns.initClient.mockReturnValue({})
    mockPinnerFns.uploadPath.mockResolvedValue('QmTestCID')

    await run()

    expect(mockPinnerFns.initClient).toHaveBeenCalledWith(
      'test-key',
      'https://ipfs.pinner.xyz'
    )
  })

  it('should set failed on unexpected error', async () => {
    mockInputs({
      'api-key': 'test-key',
      path: './dist',
      cid: '',
      endpoint: 'https://ipfs.pinner.xyz',
      'ipns-key': '',
      domain: '',
      'remove-previous': 'false'
    })
    mockPinnerFns.initClient.mockReturnValue({})
    mockPinnerFns.uploadPath.mockRejectedValue(new Error('upload failed'))

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('upload failed')
  })
})
