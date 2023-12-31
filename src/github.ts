import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'
// TODO: workaround
// eslint-disable-next-line import/no-unresolved
import { GetResponseDataTypeFromEndpointMethod } from '@octokit/types'
import fs from 'fs'
import path from 'path'
import admZip from 'adm-zip'

export type Octokit = ReturnType<typeof getOctokit>
export type WorkflowRun = GetResponseDataTypeFromEndpointMethod<
  Octokit['rest']['actions']['getWorkflowRun']
>
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

const LOG_DIR = 'logs'
const LOG_ZIP_FILE = 'logs.zip'
const LATEST_LINES = 30

export async function getWorkflowRun(
  octokit: Octokit,
  runId: number
): Promise<WorkflowRun> {
  const { data } = await octokit.rest.actions.getWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: runId
  })
  core.debug('fetched workflow run')

  return data
}

export async function getFailedJobs(
  octokit: Octokit,
  runId: number
): Promise<Jobs> {
  const { data } = await octokit.rest.actions.listJobsForWorkflowRun({
    owner: context.repo.owner,
    repo: context.repo.repo,
    run_id: runId
  })
  core.debug('fetched jobs for workflow run')

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
  core.debug('fetched run logs')

  const extractedDir = path.join(process.cwd(), LOG_DIR)
  const zipFilePath = path.join(process.cwd(), LOG_ZIP_FILE)

  fs.writeFileSync(zipFilePath, Buffer.from(res.data))
  const zip = new admZip(zipFilePath)
  zip.extractAllTo(extractedDir, true)
}

// NOTE: remove like '2023-12-05T07:08:20.6282273Z ` string each lines
// NOTE: laltest 30 lines
export function formatLog(log: string): string {
  return log
    .split('\n')
    .map(l => l.split(' ').slice(1).join(' '))
    .slice(-LATEST_LINES)
    .join('\n')
}

export async function getJobLog(job: Jobs[0]): Promise<StepLog[]> {
  const failedSteps = job.steps?.filter(s => s.conclusion === 'failure')
  const logs = failedSteps?.map(s => {
    const sanitizedJobName = job.name.replaceAll('/', '')

    const baseDir = path.join(process.cwd(), LOG_DIR)
    const normalizedPath = path.normalize(
      path.join(
        process.cwd(),
        LOG_DIR,
        sanitizedJobName,
        `${s.number}_${s.name}.txt`
      )
    )

    if (!normalizedPath.startsWith(baseDir)) {
      throw new Error('Invalid path')
    }

    const logFile = fs.readFileSync(normalizedPath)

    return {
      log: formatLog(logFile.toString()),
      stepName: s.name
    }
  })
  core.debug('get log from logfile')

  return logs || []
}

export function isDefaultErrorMessage(annotation: Annotations[0]): boolean {
  return (
    (annotation.path === '.github' &&
      annotation.message?.startsWith('Process completed with exit code')) ||
    false
  )
}

export async function getJobAnnotations(
  octokit: Octokit,
  jobId: number
): Promise<Annotations> {
  const { data } = await octokit.rest.checks.listAnnotations({
    owner: context.repo.owner,
    repo: context.repo.repo,
    check_run_id: jobId
  })
  core.debug('fetched annotations')

  const excludeDefaultErrorAnnotations = data.filter(
    a => !isDefaultErrorMessage(a)
  )
  core.debug(
    `exclude default error annotations: ${excludeDefaultErrorAnnotations.length}`
  )

  return excludeDefaultErrorAnnotations
}

export async function getSummary(
  octokit: Octokit,
  fromWorkflowRun: boolean,
  jobs: Jobs
): Promise<Summary[]> {
  core.debug(`jobs: ${jobs.length}`)

  const summary = jobs.reduce(
    async (acc, job) => {
      const annotations = await getJobAnnotations(octokit, job.id)

      if (fromWorkflowRun) {
        if (annotations.length > 0) {
          core.debug(`jobId: ${job.id}, annotations: ${annotations.length}`)
          return [...(await acc), { ...job, annotations }]
        }
        const jobLog = await getJobLog(job)
        core.debug(`jobId: ${job.id}, log: ${jobLog.length}`)
        return [...(await acc), { ...job, jobLog }]
      }

      if (annotations.length > 0) {
        core.debug(`jobId: ${job.id}, annotations: ${annotations.length}`)
        return [...(await acc), { ...job, annotations }]
      }

      return [...(await acc), { ...job }]
    },
    Promise.resolve([] as Summary[])
  )

  return summary
}
