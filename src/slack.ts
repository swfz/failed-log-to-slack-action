import {
  IncomingWebhook,
  IncomingWebhookResult,
  IncomingWebhookSendArguments
} from '@slack/webhook'
import { Block, ContextBlock, SectionBlock } from '@slack/types'
import { Annotations, StepLog, Summary, WorkflowRun } from './github'

export function generateBlocks(
  workflowRun: WorkflowRun
): [SectionBlock, ContextBlock] {
  const workflowName = workflowRun.name
  const user = workflowRun.actor?.login
  const branch = workflowRun.head_branch
  const eventName = workflowRun.event
  const repoName = `<${workflowRun.repository.html_url}|${workflowRun.repository.full_name}>`
  const num = `<${workflowRun.html_url}|#${workflowRun.run_number}>`

  const text = `
Failed: ${user}\`s \`${eventName}\` on \`${branch}\`
Workflow: ${workflowName} ${num}
`

  const block: SectionBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text
    }
  }

  const repoBlock: ContextBlock = {
    type: 'context',
    elements: [
      {
        type: 'image',
        image_url: 'https://github.githubassets.com/favicon.ico',
        alt_text: 'GitHub'
      },
      {
        type: 'mrkdwn',
        text: `*${repoName}*`
      }
    ]
  }

  return [block, repoBlock]
}

function generateAnnotationBlocks(annotations: Annotations): Block[] {
  return annotations.flatMap((a: Annotations[0]) => {
    const location = `*${a.path}: L${a.start_line}~L${a.end_line}*`
    return [
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: location
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`${a.message}\`\`\``
        }
      }
    ]
  })
}

function generateJobLogBlock(jobLog: StepLog[]): (Block | SectionBlock)[] {
  return jobLog.flatMap((log: StepLog) => {
    return [
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Step: \`${log.stepName}\``
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`${log.log}\`\`\``
        }
      }
    ]
  })
}

function generateBlocksInAttachment(summary: Summary[]): Block[] {
  return summary.flatMap(job => {
    const lines = job.annotations
      ? generateAnnotationBlocks(job.annotations)
      : generateJobLogBlock(job.jobLog || [])

    const jobName = `<${job.html_url}|${job.name}>`

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Job: ${jobName} ${job.conclusion}`
        }
      },
      ...lines
    ]
  })
}

export function generateParams(
  workflowRun: WorkflowRun,
  summary: Summary[]
): IncomingWebhookSendArguments {
  const params = {
    blocks: generateBlocks(workflowRun),
    attachments: [
      {
        color: '#a30200',
        blocks: generateBlocksInAttachment(summary)
      }
    ]
  }

  return params
}

export async function notify(
  webhookUrl: string,
  params: IncomingWebhookSendArguments
): Promise<IncomingWebhookResult> {
  const webhook = new IncomingWebhook(webhookUrl)

  return await webhook.send(params)
}
