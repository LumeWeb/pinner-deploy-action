import { setupServer } from 'msw/node'
import { getIpnsMock } from '@/test-msw/generated/ipns.js'
import { getWebsitesMock } from '@/test-msw/generated/websites.js'
import { getPinningMock } from '@/test-msw/generated/pinning.js'
import { getContentMock } from '@/test-msw/generated/content.js'

const handlers = [
  ...getIpnsMock(),
  ...getWebsitesMock(),
  ...getPinningMock(),
  ...getContentMock()
]

export const server = setupServer(...handlers)
