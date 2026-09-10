import {
  checkSpaceUsage,
  saveUsage,
  UsageEventRecord,
} from '@focus-reactive/sb-plugins-storage-sdk'
import { PLUGIN_ID } from '@src/constants'

import type { NextApiRequest, NextApiResponse } from 'next'

// Firestore holds only the usage limits, so a run without it loses no data.
const skipFirebase = process.env.DEV_SKIP_FIREBASE === 'true'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (skipFirebase) {
      if (req.method === 'GET') {
        res.status(200).json({ isUseAllowed: true })
      } else {
        res.status(200).end()
      }

      return res.end()
    }

    if (req.method === 'POST') {
      const { eventName, pluginId, spaceId, userId, errorMessage } = JSON.parse(
        req.body,
      )

      await saveUsage({
        eventName,
        pluginId,
        spaceId,
        userId,
        errorMessage,
      } as UsageEventRecord)

      res.status(200).end()
    } else if (req.method === 'GET') {
      const { spaceId } = req.query

      const isUseAllowed = await checkSpaceUsage({
        spaceId: +spaceId,
        pluginId: PLUGIN_ID,
      })

      res.status(200).json({ isUseAllowed })
      res.end()
    }
  } catch (error) {
    res.status(500).json(error)
    res.end()
  }
}
