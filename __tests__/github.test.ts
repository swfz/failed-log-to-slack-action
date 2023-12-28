import { setupServer } from 'msw/node'
import { handlers } from '../src/mocks/handler'
import { getOctokit } from '@actions/github'
import { getFailedJobs, getJobAnnotations } from '../src/github'

const server = setupServer(...handlers)

describe('github', () => {
  beforeEach(() => {
    server.listen()
  })
  afterAll(() => {
    server.close()
  })
  const octokit = getOctokit('dummy', { request: fetch })

  it('failedJobs has one', async () => {
    const failedJobs = await getFailedJobs(octokit, 1)

    expect(failedJobs).toHaveLength(1)
    expect(failedJobs[0].name).toEqual('job1')
  })

  it('no failedJobs', async () => {
    const failedJobs = await getFailedJobs(octokit, 2)

    expect(failedJobs).toHaveLength(0)
  })

  it('jobAnnotations', async () => {
    const jobAnnotations = await getJobAnnotations(octokit, 1)

    expect(jobAnnotations).toHaveLength(1)
  })
})
