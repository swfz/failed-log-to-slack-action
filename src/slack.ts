import { context } from '@actions/github'
import { IncomingWebhook, IncomingWebhookResult } from '@slack/webhook'
import { MessageAttachment, SectionBlock } from '@slack/types'
import { Jobs, Annotations } from './github'

function generateBlocks(job: Jobs[0]): SectionBlock[] {
  const workflowName = `[${job.workflow_name}](${job.html_url})`

  const text = `
${job.name} ${job.conclusion} in ${workflowName} at ${context.eventName}
`
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text
      }
    }
  ]
}

function generateAttachments(annotations: Annotations): MessageAttachment[] {
  return annotations.map(a => {
    const title = `*${a.path}: L${a.start_line}~L${a.end_line}*`
    return {
      color: 'danger',
      pretext: title,
      text: `${a.message}`
    }
  })
}

export async function toChannel(
  webhookUrl: string,
  job: Jobs[0],
  annotations: Annotations
): Promise<IncomingWebhookResult> {
  const webhook = new IncomingWebhook(webhookUrl)

  return await webhook.send({
    blocks: generateBlocks(job),
    attachments: generateAttachments(annotations)
  })
}
