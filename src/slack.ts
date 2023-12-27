import { context } from '@actions/github'
import { IncomingWebhook, IncomingWebhookResult } from '@slack/webhook'
import { Block, SectionBlock } from '@slack/types'
import { Annotations, Summary } from './github'

export async function notify(
  webhookUrl: string,
  summary: Summary[]
): Promise<IncomingWebhookResult> {
  const webhook = new IncomingWebhook(webhookUrl)

  const conclusion = context.payload.workflow_run.conclusion
  const workflowName = context.payload.workflow.name
  const user = context.payload.actor?.login
  const branch = context.payload.workflow_run.head_branch
  const eventName = context.payload.workflow_run.event

  const block: SectionBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `${workflowName} ${conclusion} by ${user} in ${branch} at ${eventName}`
    }
  }

  const blocks = blocksInAttachment(summary)

  return await webhook.send({
    blocks: [block],
    attachments: [
      {
        color: '#a30200',
        blocks
      }
    ]
  })
}

function blocksInAttachment(summary: Summary[]): Block[] {
  return summary.flatMap(job => {
    const annotations = job.annotations.flatMap((a: Annotations[0]) => {
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

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${job.name} ${job.conclusion}`
        }
      },
      ...annotations
    ]
  })
}
