import { http, HttpResponse } from 'msw'
import workflowRun from './responses/workflow_run.json'
import annotationDefault from './responses/check_run_annotation-default.json'
import annotationMultiline from './responses/check_run_annotation-multiline.json'

export const handlers = [
  http.get(
    'https://api.github.com/repos/*/*/check-runs/*/annotations',
    ({ params }) => {
      // params[2]: check_run_id
      const annotations =
        params[2] === '1' ? [annotationMultiline, annotationDefault] : []

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
  }),
  http.post('https://hooks.slack.com/*', () => {
    return HttpResponse.json({ mocked: true })
  })
]
