import { defineConfig } from 'orval'

// TODO: When @lumeweb/pinner exports MSW handlers, replace local generation with importing from the lib
export default defineConfig({
  pinner: {
    input: './swagger.yaml',
    output: {
      mode: 'tags',
      client: 'fetch',
      target: './src/test-msw/generated/api.ts',
      schemas: './src/test-msw/generated/schemas',
      mock: {
        generators: [
          {
            type: 'msw',
            target: './src/test-msw/generated/handlers.ts'
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- orval type defs don't include target in generators
          } as any
        ]
      }
    }
  }
})
