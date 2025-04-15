import { Readable } from 'stream'
import { WebClient } from '@slack/web-api'

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  let result

  try {
    if (req.method === 'POST') {
      const { message, story, spaceId, original } = JSON.parse(req.body)
      const slackWebhookURL = process.env.SLACK_INCOMING_WEBHOOK_URL_AI_TOOL

      if (story) {
        const type = original ? 'Original' : 'Translated'
        const web = new WebClient(process.env.SLACK_TOKEN)
        const buffer = Buffer.from(JSON.stringify(story))
        const filename = `${type}_${story.name}_${spaceId}.json`

        const response = await web.filesUploadV2({
          channel_id: process.env.SLACK_CHANNEL,
          file: Readable.from(buffer),
          initial_comment: `${type} story: ${story.name} for space: ${spaceId}`,
          filename,
        })

        result = response
      }

      if (message) {
        const response = await fetch(slackWebhookURL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: story ? story : JSON.stringify(message),
        })

        result = await response.text()
      }

      res.status(200).json({ result })
    }
  } catch (error) {
    console.log(error)

    res.status(500).json({ error })
    res.end()
  }
}
