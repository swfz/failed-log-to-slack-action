import { http, HttpResponse } from 'msw'
import workflowRun from './responses/workflow_run.json'

export const handlers = [
  http.get(
    'https://api.github.com/repos/*/*/check-runs/*/annotations',
    ({ params }) => {
      // params[2]: check_run_id
      const annotations =
        params[2] === '1'
          ? [
              {
                annotation_level: 'failure',
                path: 'path/to/file',
                start_line: 1,
                end_line: 1,
                title: 'Some annotation',
                message: `
hoge
fuga
piyo
`
              },
              {
                path: '.github',
                annotation_level: 'failure',
                start_line: 300,
                end_line: 300,
                title: 'hoge',
                message: 'Process completed with exit code 1.'
              }
            ]
          : []

      return HttpResponse.json(annotations)
    }
  ),
  http.get(
    'https://api.github.com/repos/*/*/actions/runs/*/jobs',
    ({ params }) => {
      // params[2]: run_id
      const jobs =
        params[2] === '1'
          ? [
              {
                run_id: 1,
                name: 'job1',
                status: 'completed',
                conclusion: 'failure'
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
                status: 'running',
                conclusion: null
              }
            ]
          : []
      return HttpResponse.json({ jobs })
    }
  ),
  http.get('https://api.github.com/repos/*/*/actions/runs/*', () => {
    return HttpResponse.json(workflowRun)
  }),
  http.get('https://api.github.com/*', () => {
    return HttpResponse.json({ mocked: true })
  })
]
