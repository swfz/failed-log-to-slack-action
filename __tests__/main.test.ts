import { setupServer } from 'msw/node'
import { handlers } from '../src/mocks/handler'
import { HttpResponse, http } from 'msw'
import { IncomingWebhookResult } from '@slack/webhook'

let coreInfoMock: jest.SpyInstance
let webhookSendMock: jest.SpyInstance
// eslint-disable-next-line no-undef
let originEnv: NodeJS.ProcessEnv

describe('run from workflow_run event', () => {
  const server = setupServer(...handlers)

  beforeEach(async () => {
    originEnv = process.env
    process.env = {
      ...originEnv,
      GITHUB_EVENT_NAME: 'workflow_run',
      GITHUB_EVENT_PATH: './src/mocks/events/workflow_run.json',
      GITHUB_REPOSITORY: 'swfz/failed-log-to-slack-action'
    }

    server.listen()

    jest.clearAllMocks()
    jest.mock('@actions/core', () => {
      const originalModule = jest.requireActual('@actions/core')
      coreInfoMock = jest.fn()
      return {
        ...originalModule,
        info: coreInfoMock,
        getInput: jest.fn().mockImplementation((name: string): string => {
          switch (name) {
            case 'github-token':
              return 'xxxxx'
            case 'slack-webhook-url':
              return 'https://hooks.slack.com/services/xxxxx'
            default:
              return ''
          }
        })
      }
    })
    jest.mock('@slack/webhook', () => {
      const originalModule = jest.requireActual('@slack/webhook')
      webhookSendMock = jest
        .fn()
        .mockImplementation(
          async (): Promise<IncomingWebhookResult> =>
            Promise.resolve({ text: 'ok' })
        )
      return {
        ...originalModule,
        IncomingWebhook: jest.fn().mockImplementation(() => {
          return {
            send: webhookSendMock
          }
        })
      }
    })
  })
  afterAll(() => {
    process.env = originEnv
    server.close()
    jest.resetModules()
  })

  it('environment', async () => {
    expect(process.env.GITHUB_EVENT_NAME).toEqual('workflow_run')
  })

  it('run with no failed jobs', async () => {
    const main = await import('../src/main')

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

  it('run with failed jobs', async () => {
    const main = await import('../src/main')

    const jobUrl = 'https://github.com/octocat/octocat/actions/runs/1/jobs/3'
    const jobUrl2 = 'https://github.com/octocat/octocat/actions/runs/1/jobs/4'
    const jobName = 'test'
    const jobName2 = 'typecheck'
    const stepName = 'test'
    const stepName2 = 'typecheck'
    server.use(
      http.get('https://api.github.com/repos/*/*/actions/runs/*/jobs', () => {
        return HttpResponse.json({
          jobs: [
            {
              run_id: 1,
              id: 2,
              name: 'job1',
              status: 'completed',
              conclusion: 'success'
            },
            {
              run_id: 1,
              id: 10,
              name: 'test',
              status: 'completed',
              conclusion: 'failure',
              number: 4,
              html_url: jobUrl,
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
                  name: stepName,
                  number: 4,
                  conclusion: 'failure',
                  status: 'completed',
                  completed_at: '2023-12-30T09:01:00Z',
                  started_at: '2023-12-30T09:00:00Z'
                }
              ]
            },
            {
              run_id: 1,
              id: 4,
              name: 'typecheck',
              status: 'completed',
              conclusion: 'failure',
              number: 4,
              html_url: jobUrl2,
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
                  name: stepName2,
                  number: 4,
                  conclusion: 'failure',
                  status: 'completed',
                  completed_at: '2023-12-30T09:01:00Z',
                  started_at: '2023-12-30T09:00:00Z'
                }
              ]
            }
          ]
        })
      })
    )

    await main.run()

    expect(coreInfoMock).toHaveBeenNthCalledWith(1, '{"text":"ok"}')

    // NOTE: parameter specific
    // attachments.blocks
    // 1. job name(link) and conclusion
    // repeat Annotation pattern or Log pattern
    // ------
    // Annotation pattern
    // 1. divider
    // 2. annotation location
    // 3. annotation message
    // ------
    // Log pattern
    // 1. divider
    // 2. step name
    // 3. job log
    expect(webhookSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              // TODO: required workflowName, num, user, eventName, branch
              text: expect.anything()
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'image',
                image_url: 'https://github.githubassets.com/favicon.ico',
                alt_text: 'GitHub'
              },
              {
                type: 'mrkdwn',
                // TODO: required repository url
                text: expect.anything()
              }
            ]
          }
        ],
        attachments: [
          {
            color: '#a30200',
            blocks: [
              // job name
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining(jobName)
                }
              },
              // annotation pattern
              { type: 'divider' },
              // annotation location
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining('hoge.tsx: L100~L100')
                }
              },
              // annotation message
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining('tests in hoge')
                }
              },
              { type: 'divider' },
              // annotation location
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining('hoge.tsx: L50~L50')
                }
              },
              // annotation message
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining('tests in hoge')
                }
              },
              // job name
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining(jobName2)
                }
              },
              // log pattern
              { type: 'divider' },
              // log failed step name
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining(stepName2)
                }
              },
              // log last 30 lines
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining(
                    'Process completed with exit code'
                  )
                }
              }
            ]
          }
        ]
      })
    )
  })
})

describe('run from push event', () => {
  const server = setupServer(...handlers)

  beforeEach(async () => {
    originEnv = process.env
    process.env = {
      ...originEnv,
      GITHUB_EVENT_NAME: 'push',
      GITHUB_RUN_ID: '1',
      GITHUB_REPOSITORY: 'swfz/failed-log-to-slack-action'
    }

    server.listen()

    jest.clearAllMocks()
    jest.mock('@actions/core', () => {
      const originalModule = jest.requireActual('@actions/core')
      coreInfoMock = jest.fn()
      return {
        ...originalModule,
        info: coreInfoMock,
        getInput: jest.fn().mockImplementation((name: string): string => {
          switch (name) {
            case 'github-token':
              return 'xxxxx'
            case 'slack-webhook-url':
              return 'https://hooks.slack.com/services/xxxxx'
            default:
              return ''
          }
        })
      }
    })
    jest.mock('@slack/webhook', () => {
      const originalModule = jest.requireActual('@slack/webhook')
      webhookSendMock = jest
        .fn()
        .mockImplementation(
          async (): Promise<IncomingWebhookResult> =>
            Promise.resolve({ text: 'ok' })
        )
      return {
        ...originalModule,
        IncomingWebhook: jest.fn().mockImplementation(() => {
          return {
            send: webhookSendMock
          }
        })
      }
    })
  })
  afterAll(() => {
    process.env = originEnv
    server.close()
    jest.resetModules()
  })

  it('environment', async () => {
    expect(process.env.GITHUB_EVENT_NAME).toEqual('push')
  })

  it('run with no failed jobs', async () => {
    const main = await import('../src/main')

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

  it('run with failed jobs', async () => {
    const main = await import('../src/main')

    const jobUrl = 'https://github.com/octocat/octocat/actions/runs/1/jobs/3'
    const jobUrl2 = 'https://github.com/octocat/octocat/actions/runs/1/jobs/4'
    const jobName = 'test'
    const jobName2 = 'typecheck'
    const stepName = 'test'
    const stepName2 = 'typecheck'
    server.use(
      http.get('https://api.github.com/repos/*/*/actions/runs/*/jobs', () => {
        return HttpResponse.json({
          jobs: [
            {
              run_id: 1,
              id: 2,
              name: 'job1',
              status: 'completed',
              conclusion: 'success'
            },
            {
              run_id: 1,
              id: 10,
              name: 'test',
              status: 'completed',
              conclusion: 'failure',
              number: 4,
              html_url: jobUrl,
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
                  name: stepName,
                  number: 4,
                  conclusion: 'failure',
                  status: 'completed',
                  completed_at: '2023-12-30T09:01:00Z',
                  started_at: '2023-12-30T09:00:00Z'
                }
              ]
            },
            {
              run_id: 1,
              id: 4,
              name: 'typecheck',
              status: 'completed',
              conclusion: 'failure',
              number: 4,
              html_url: jobUrl2,
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
                  name: stepName2,
                  number: 4,
                  conclusion: 'failure',
                  status: 'completed',
                  completed_at: '2023-12-30T09:01:00Z',
                  started_at: '2023-12-30T09:00:00Z'
                }
              ]
            }
          ]
        })
      })
    )

    await main.run()

    expect(coreInfoMock).toHaveBeenNthCalledWith(1, '{"text":"ok"}')

    // NOTE: parameter specific
    // attachments.blocks
    // 1. job name(link) and conclusion
    // repeat Annotation pattern or Log pattern
    // ------
    // Annotation pattern
    // 1. divider
    // 2. annotation location
    // 3. annotation message
    // ------
    // Log pattern
    // 1. divider
    // 2. step name
    // 3. job log
    expect(webhookSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              // TODO: required workflowName, num, user, eventName, branch
              text: expect.anything()
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'image',
                image_url: 'https://github.githubassets.com/favicon.ico',
                alt_text: 'GitHub'
              },
              {
                type: 'mrkdwn',
                // TODO: required repository url
                text: expect.anything()
              }
            ]
          }
        ],
        attachments: [
          {
            color: '#a30200',
            blocks: [
              // job name
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining(jobName)
                }
              },
              // annotation pattern
              { type: 'divider' },
              // annotation location
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining('hoge.tsx: L100~L100')
                }
              },
              // annotation message
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining('tests in hoge')
                }
              },
              { type: 'divider' },
              // annotation location
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining('hoge.tsx: L50~L50')
                }
              },
              // annotation message
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining('tests in hoge')
                }
              },
              // job name
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining(jobName2)
                }
              }
            ]
          }
        ]
      })
    )
  })
})
