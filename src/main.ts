import * as core from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { notify } from './slack'
import { getFailedJobs, getJobLogZip, getSummary } from './github'

export async function run(): Promise<void> {
  try {
    const fromWorkflowRun = context.eventName === 'workflow_run'
    const runId = fromWorkflowRun
      ? parseInt(context.payload.workflow_run.id)
      : context.runId

    const githubToken =
      process.env.INPUT_GITHUB_TOKEN ||
      core.getInput('github-token', { required: true })
    const webhookUrl =
      process.env.SLACK_WEBHOOK_URL ||
      core.getInput('slack-webhook-url', { required: true })
    core.setSecret(githubToken)
    core.setSecret(webhookUrl)

    const octokit = getOctokit(githubToken)
    const failedJobs = await getFailedJobs(octokit, runId)

    await getJobLogZip(octokit, runId)

    if (failedJobs.length === 0) {
      console.log('No failed jobs found.')
      return
    } else {
      const summary = await getSummary(octokit, failedJobs)
      const result = await notify(webhookUrl, summary)
      console.log(result)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
