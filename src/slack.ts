import { context } from '@actions/github'
import { IncomingWebhook, IncomingWebhookResult } from '@slack/webhook'
import { Block, SectionBlock } from '@slack/types'
import { Annotations, JobLog, Summary } from './github'

function generateBlocks(): Block[] {
  const run = context.payload.workflow_run

  const conclusion = context.payload.workflow_run.conclusion
  const workflowName = run.name
  const user = run?.actor?.login
  const branch = run.head_branch
  const eventName = run.event
  const repoName = `<${context.payload.repository?.html_url}|${context.payload.repository?.full_name}>`
  const num = `<${run.html_url}|#${context.payload.workflow_run.run_number}>`

  const text = `
${conclusion}: ${user}\`s \`${eventName}\` on \`${branch}\`
Workflow: ${workflowName} ${num}
`

  const block: SectionBlock = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text
    }
  }

  const repoBlock = {
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

function generateJobLogBlock(jobLog: JobLog): (Block | SectionBlock)[] {
  return [
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `\`\`\`${jobLog}\`\`\``
      }
    }
  ]
}

function generateBlocksInAttachment(summary: Summary[]): Block[] {
  return summary.flatMap(job => {
    const lines = job.annotations
      ? generateAnnotationBlocks(job.annotations)
      : generateJobLogBlock(job.jobLog)

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

export async function notify(
  webhookUrl: string,
  summary: Summary[]
): Promise<IncomingWebhookResult> {
  const webhook = new IncomingWebhook(webhookUrl)

  return await webhook.send({
    blocks: generateBlocks(),
    attachments: [
      {
        color: '#a30200',
        blocks: generateBlocksInAttachment(summary)
      }
    ]
  })
}
