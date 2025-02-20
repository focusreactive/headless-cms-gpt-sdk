import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method === 'POST') {
      const { message } = JSON.parse(req.body)
      const slackWebhookURL = process.env.SLACK_INCOMING_WEBHOOK_URL_AI_TOOL

      await fetch(slackWebhookURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      })

      res.status(200).end()
    }
  } catch (error) {
    console.log(error)

    res.status(500).json({ error })
    res.end()
  }
}
