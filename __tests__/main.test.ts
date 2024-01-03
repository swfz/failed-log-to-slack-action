import * as core from '@actions/core'
import * as main from '../src/main'
import { setupServer } from 'msw/node'
import { handlers } from '../src/mocks/handler'
import { HttpResponse, http } from 'msw'
import { IncomingWebhook, IncomingWebhookResult } from '@slack/webhook'

const server = setupServer(...handlers)

let coreInfoMock: jest.SpyInstance
let webhookSendMock: jest.SpyInstance

describe('action', () => {
  beforeEach(() => {
    server.listen()

    jest.clearAllMocks()
    jest.spyOn(core, 'getInput').mockImplementation((name: string): string => {
      switch (name) {
        case 'github-token':
          return 'xxxxx'
        case 'slack-webhook-url':
          return 'https://hooks.slack.com/services/xxxxx'
        default:
          return ''
      }
    })
    coreInfoMock = jest.spyOn(core, 'info').mockImplementation()
    webhookSendMock = jest
      .spyOn(IncomingWebhook.prototype, 'send')
      .mockImplementation(
        async (): Promise<IncomingWebhookResult> =>
          Promise.resolve({ text: 'ok' })
      )
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

  it('run with failed jobs', async () => {
    const jobUrl = 'https://github.com/octocat/octocat/actions/runs/1/jobs/3'
    const stepName = 'test'
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
            }
          ]
        })
      })
    )

    await main.run()

    expect(coreInfoMock).toHaveBeenNthCalledWith(1, '{"text":"ok"}')
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
              // job and annotations,logs each failed jobs
              // first line: job name(link) and conclusion
              {
                type: 'section',
                text: expect.anything()
              },
              // after second line each steps:
              // 1. divider
              // 2. step name
              // 3. annotations or log
              { type: 'divider' },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.stringContaining(stepName)
                }
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: expect.anything()
                }
              }
            ]
          }
        ]
      })
    )
  })
})
