import * as core from '@actions/core'
import * as main from '../src/main'
import { setupServer } from 'msw/node'
import { handlers } from '../src/mocks/handler'
import { HttpResponse, http } from 'msw'

const server = setupServer(...handlers)

let coreInfoMock: jest.SpyInstance

describe('action', () => {
  beforeEach(() => {
    server.listen()

    jest.clearAllMocks()
    jest.spyOn(core, 'getInput').mockImplementation(() => 'xxxxx')
    coreInfoMock = jest.spyOn(core, 'info').mockImplementation()
  })
  afterAll(() => {
    server.close()
  })

  it('run with no failed jobs', async () => {
    server.use(
      http.get('https://api.github.com/repos/*/*/actions/runs/*/jobs', () => {
        return HttpResponse.json({
          jobs: [
            {
              run_id: 1,
              name: 'job1',
              status: 'completed',
              conclusion: 'success'
            },
            {
              run_id: 1,
              name: 'job2',
              status: 'completed',
              conclusion: 'success'
            },
            {
              run_id: 1,
              name: 'job3',
              status: 'completed',
              conclusion: 'success'
            }
          ]
        })
      })
    )
    await main.run()
    expect(coreInfoMock).toHaveBeenNthCalledWith(1, 'No failed jobs found.')
  })
})
