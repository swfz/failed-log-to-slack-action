import { context, getOctokit } from '@actions/github'
// TODO: workaround
// eslint-disable-next-line import/no-unresolved
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types'
import * as fs from 'fs'
import admZip from 'adm-zip'

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
export type Summary = Jobs[0] & {
  annotations?: Annotations
  jobLog?: StepLog[]
}
export type StepLog = { log: string; stepName: string }

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

export async function getJobLogZip(
  octokit: Octokit,
  runId: number
): Promise<void> {
  const res = await octokit.request(
    `GET /repos/${context.repo.owner}/${context.repo.repo}/actions/runs/${runId}/logs`
  )

  fs.writeFileSync('logs.zip', Buffer.from(res.data))
  const zip = new admZip('logs.zip')
  zip.extractAllTo('./tmp', true)
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
): Promise<StepLog[]> {
  const failedSteps = job.steps?.filter(s => s.conclusion === 'failure')
  const logs = failedSteps?.map(s => {
    const sanitizedJobName = job.name.replaceAll('/', '')
    const logFile = fs.readFileSync(
      `./tmp/${sanitizedJobName}/${s.number}_${s.name}.txt`
    )

    // NOTE: remove like '2023-12-05T07:08:20.6282273Z ` string each lines
    // NOTE: laltest 30 lines
    return {
      log: logFile
        .toString()
        .split('\n')
        .map(l => l.split(' ').slice(1).join(' '))
        .slice(-30)
        .join('\n'),
      stepName: s.name
    }
  })

  return logs || []
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
