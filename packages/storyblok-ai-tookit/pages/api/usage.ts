import {
  checkSpaceUsage,
  saveUsage,
  UsageEventRecord,
} from '@focus-reactive/sb-plugins-storage-sdk'
import { PLUGIN_ID } from '@src/constants'

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
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
