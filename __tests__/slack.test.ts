import { setupServer } from 'msw/node'
import { handlers } from '../src/mocks/handler'
import { generateBlocks } from '../src/slack'
import workflowRun from './../src/mocks/responses/workflow_run.json'

describe('slack', () => {
  const server = setupServer(...handlers)

  beforeEach(() => {
    server.listen()
  })
  afterAll(() => {
    server.close()
  })

  it('generateBlocks', () => {
    const workflowName = 'test-workflow'
    const blocks = generateBlocks({
      ...workflowRun,
      id: 1,
      name: workflowName,
      actor: {
        ...workflowRun.actor,
        login: 'octocat'
      },
      repository: {
        ...workflowRun.repository,
        full_name: 'octocat/octocat',
        html_url: 'https://github.com/octocat/octocat'
      },
      head_branch: 'test-branch',
      event: 'test-event',
      html_url: 'https://github.com/octocat/octocat/actions/runs/1',
      run_number: 1
    })

    expect(blocks).toHaveLength(2)
    expect(blocks[0]?.text?.text).toContain('Workflow: test-workflow')
  })
})
