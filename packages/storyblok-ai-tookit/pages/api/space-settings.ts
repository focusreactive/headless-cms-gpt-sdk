import {
  getSpaceSettings,
  saveSpaceSettings,
} from '@focus-reactive/sb-plugins-storage-sdk'
import { PLUGIN_ID } from '@src/constants'

import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (req.method === 'POST') {
      const { pluginId, spaceId, notTranslatableWords } = JSON.parse(req.body)

      await saveSpaceSettings({
        pluginId,
        spaceId,
        notTranslatableWords,
      })

      res.status(200).end()
    } else if (req.method === 'GET') {
      const { spaceId } = req.query

      const spaceSettings = await getSpaceSettings({
        spaceId: +spaceId,
        pluginId: PLUGIN_ID,
      })

      res.status(200).json(spaceSettings)
      res.end()
    }
  } catch (error) {
    console.log(error)

    res.status(500).json({ error })
    res.end()
  }
}
