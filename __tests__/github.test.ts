import { setupServer } from 'msw/node'
import { handlers } from '../src/mocks/handler'
import { getOctokit } from '@actions/github'
import {
  Jobs,
  formatLog,
  getFailedJobs,
  getJobAnnotations,
  getJobLog,
  getJobLogZip,
  getWorkflowRun
} from '../src/github'
import runJobs from '../src/mocks/responses/runs_jobs.json'

import fs from 'fs'

// eslint-disable-next-line no-undef
let originEnv: NodeJS.ProcessEnv

const server = setupServer(...handlers)

describe('github', () => {
  beforeEach(() => {
    originEnv = process.env
    process.env = {
      ...originEnv,
      GITHUB_REPOSITORY: 'swfz/failed-log-to-slack-action'
    }

    server.listen()
  })
  afterAll(() => {
    process.env = originEnv
    server.close()
  })
  const octokit = getOctokit('dummy', { request: fetch })

  it('getWorkflowRun', async () => {
    const workflowRun = await getWorkflowRun(octokit, 1)

    expect(workflowRun.id).toEqual(30433642)
  })

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

  it('formatLog', () => {
    const raw = `2023-12-05T07:08:20.6282273Z [info] log started
2023-12-05T07:08:20.6282273Z line2
2023-12-05T07:08:20.6282273Z line3
2023-12-05T07:08:20.6282273Z line4
2023-12-05T07:08:20.6282273Z line5
2023-12-05T07:08:20.6282273Z line6
2023-12-05T07:08:20.6282273Z line7
2023-12-05T07:08:20.6282273Z line8
2023-12-05T07:08:20.6282273Z line9
2023-12-05T07:08:20.6282273Z line10
2023-12-05T07:08:20.6282273Z line11
2023-12-05T07:08:20.6282273Z line12
2023-12-05T07:08:20.6282273Z line13
2023-12-05T07:08:20.6282273Z line14
2023-12-05T07:08:20.6282273Z line15
2023-12-05T07:08:20.6282273Z line16
2023-12-05T07:08:20.6282273Z line17
2023-12-05T07:08:20.6282273Z line18
2023-12-05T07:08:20.6282273Z line19
2023-12-05T07:08:20.6282273Z line20
2023-12-05T07:08:20.6282273Z line21
2023-12-05T07:08:20.6282273Z line22
2023-12-05T07:08:20.6282273Z line23
2023-12-05T07:08:20.6282273Z line24
2023-12-05T07:08:20.6282273Z line25
2023-12-05T07:08:20.6282273Z line26
2023-12-05T07:08:20.6282273Z line27
2023-12-05T07:08:20.6282273Z line28
2023-12-05T07:08:20.6282273Z line29
2023-12-05T07:08:20.6282273Z line30
2023-12-05T07:08:20.6282273Z line31
2023-12-05T07:08:20.6282273Z [info] log end`

    const formattedLog = formatLog(raw)

    expect(formattedLog).toEqual(`line3
line4
line5
line6
line7
line8
line9
line10
line11
line12
line13
line14
line15
line16
line17
line18
line19
line20
line21
line22
line23
line24
line25
line26
line27
line28
line29
line30
line31
[info] log end`)
  })

  it('download zip and get log', async () => {
    const doesFileExist = (filePath: string): boolean => {
      return fs.existsSync(filePath)
    }

    await getJobLogZip(octokit, 1)
    expect(doesFileExist('logs/build/4_build.txt')).toBe(true)

    const jobs = runJobs.jobs as Jobs

    const stepLogs = await getJobLog({
      ...jobs[0],
      name: 'test',
      steps: [
        {
          name: 'Run actionsetup-node',
          number: 3,
          conclusion: 'success',
          status: 'completed',
          completed_at: '2023-12-30T09:01:00Z',
          started_at: '2023-12-30T09:00:00Z'
        },
        {
          name: 'test',
          number: 4,
          conclusion: 'failure',
          status: 'completed',
          completed_at: '2023-12-30T09:01:00Z',
          started_at: '2023-12-30T09:00:00Z'
        }
      ]
    })

    expect(stepLogs).toHaveLength(1)
    expect(stepLogs[0].stepName).toEqual('test')

    const firstLine = stepLogs[0].log.split('\n')[0]
    expect(firstLine).toEqual(`PASS src/components/__tests__/line.tsx`)
  })
})
