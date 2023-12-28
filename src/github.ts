import { context, getOctokit } from '@actions/github'
// TODO: workaround
// eslint-disable-next-line import/no-unresolved
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types'

export type Octokit = ReturnType<typeof getOctokit>
export type Jobs = GetResponseDataTypeFromEndpointMethod<
  Octokit['rest']['actions']['listJobsForWorkflowRun']
>['jobs']
export type Annotations = GetResponseDataTypeFromEndpointMethod<
  Octokit['rest']['checks']['listAnnotations']
>
export type JobLog = GetResponseDataTypeFromEndpointMethod<
  Octokit['rest']['actions']['downloadJobLogsForWorkflowRun']
>
export type Summary = Jobs[0] & { annotations?: Annotations; jobLog?: JobLog }

export async function getFailedJobs(
  octokit: Octokit,
  runId: number
): Promise<Jobs> {
  const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: runId
  })

  const completedJobs = data.jobs.filter(j => j.status === 'completed')
  const failedJobs = completedJobs.filter(j => j.conclusion === 'failure')

  return failedJobs || []
}

function isDefaultErrorMessage(annotation: Annotations[0]): boolean {
  return (
    (annotation.path === '.github' &&
      annotation.message?.startsWith('Process completed with exit code')) ||
    false
  )
}

export async function getJobLog(
  octokit: Octokit,
  job: Jobs[0]
): Promise<JobLog> {
  const { data } = await octokit.rest.actions.downloadJobLogsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    job_id: job.id
  })

  // NOTE: remove like '2023-12-05T07:08:20.6282273Z ` string each lines
  const lines = (data as string)
    .split('\n')
    .map(l => l.split(' ').slice(1).join(' '))

  // NOTE: Logs of all steps are returned
  // NOTE: Identify the location of the error from all logs
  const errorIndex =
    lines.findIndex(l =>
      l.startsWith('##[error]Process completed with exit code')
    ) || lines.length

  return lines.slice(errorIndex - 30, errorIndex).join('\n')
}

export async function getJobAnnotations(
  octokit: Octokit,
  job: Jobs[0]
): Promise<Annotations> {
  const { data } = await octokit.rest.checks.listAnnotations({
    owner: context.repo.owner,
    repo: context.repo.repo,
    check_run_id: job.id
  })

  const excludeDefaultErrorAnnotations = data.filter(
    a => !isDefaultErrorMessage(a)
  )

  return excludeDefaultErrorAnnotations
}

export async function getSummary(
  octokit: Octokit,
  jobs: Jobs
): Promise<Summary[]> {
  const summary = jobs.reduce(
    async (acc, job) => {
      const annotations = await getJobAnnotations(octokit, job)
      if (annotations.length > 0) {
        return [...(await acc), { ...job, annotations }]
      } else {
        const jobLog = await getJobLog(octokit, job)
        return [...(await acc), { ...job, jobLog }]
      }
    },
    Promise.resolve([] as Summary[])
  )

  return summary
}
