import { setupServer } from 'msw/node'
import {
  getIpnsMock,
  getWebsitesMock,
  getPinningMock,
  getContentMock
} from '@lumeweb/pinner/mocks'

const handlers = [
  ...getIpnsMock(),
  ...getWebsitesMock(),
  ...getPinningMock(),
  ...getContentMock()
]

export const server = setupServer(...handlers)
