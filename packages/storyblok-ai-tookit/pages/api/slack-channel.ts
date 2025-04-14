import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method === 'POST') {
      const { message, story } = JSON.parse(req.body)
      const slackWebhookURL = process.env.SLACK_INCOMING_WEBHOOK_URL_AI_TOOL

      const response = await fetch(slackWebhookURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: story ? story : JSON.stringify(message),
      })

      const result = await response.text()

      res.status(200).json({ result })
    }
  } catch (error) {
    console.log(error)

    res.status(500).json({ error })
    res.end()
  }
}
