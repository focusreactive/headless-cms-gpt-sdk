import {
  getSpaceSettings,
  saveSpaceSettings,
} from '@focus-reactive/sb-plugins-storage-sdk'
import { PLUGIN_ID } from '@src/constants'

import type { NextApiRequest, NextApiResponse } from 'next'

const skipFirebase = process.env.DEV_SKIP_FIREBASE === 'true'

const localSpaceSettings = {
  id: undefined,
  pluginId: PLUGIN_ID,
  notTranslatableWords: { set: [] as string[], limit: 50 },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (skipFirebase) {
      if (req.method === 'GET') {
        res.status(200).json(localSpaceSettings)
      } else {
        res.status(200).end()
      }

      return res.end()
    }

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
