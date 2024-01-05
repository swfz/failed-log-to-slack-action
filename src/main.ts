import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { generateParams, notify } from './slack'
import {
  getFailedJobs,
  getJobLogZip,
  getSummary,
  getWorkflowRun
} from './github'

export async function run(): Promise<void> {
  try {
    const fromWorkflowRun = context.eventName === 'workflow_run'
    const runId = fromWorkflowRun
      ? parseInt(context.payload.workflow_run.id)
      : context.runId

    core.debug(`event: ${context.eventName}`)
    core.debug(`runId: ${runId}`)

    const githubToken =
      process.env.INPUT_GITHUB_TOKEN ||
      core.getInput('github-token', { required: true })
    const webhookUrl =
      process.env.SLACK_WEBHOOK_URL ||
      core.getInput('slack-webhook-url', { required: true })
    core.setSecret(githubToken)
    core.setSecret(webhookUrl)

    const octokit = getOctokit(githubToken, { request: fetch })
    const workflowRun = await getWorkflowRun(octokit, runId)
    const failedJobs = await getFailedJobs(octokit, runId)

    if (failedJobs.length === 0) {
      core.info('No failed jobs found.')
      return
    }

    // Except for the `workflow_run` event, the current log is being processed,
    // so a request to the log file endpoint will result in a `not found` error.
    if (fromWorkflowRun) {
      await getJobLogZip(octokit, runId)
    }

    const summary = await getSummary(octokit, fromWorkflowRun, failedJobs)
    const result = await notify(
      webhookUrl,
      generateParams(workflowRun, summary)
    )
    core.info(JSON.stringify(result))
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
