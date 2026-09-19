import {
  getSpaceSettings,
  saveSpaceSettings,
} from '@focus-reactive/sb-plugins-storage-sdk'
import { PLUGIN_ID } from '@src/constants'

import type { NextApiRequest, NextApiResponse } from 'next'

const skipFirebase = process.env.DEV_SKIP_FIREBASE === 'true'

/**
 * What the route answers with no Firebase behind it.
 *
 * It holds what was written to it for as long as the process lives, which is what keeps
 * the panel usable in development: the plugin talks to this route the same way it will
 * talk to the real one, so there is one implementation above it rather than a branch that
 * only the developer ever exercises. Nothing here survives a restart, and nothing here is
 * per-space — it is a stand-in, not a store.
 */
const localSpaceSettings: Record<string, unknown> = {
  id: undefined,
  pluginId: PLUGIN_ID,
  notTranslatableWords: { set: [] as string[], limit: 50 },
}

/**
 * What the caller sent. Next parses the body itself when the request says it is JSON and
 * leaves it a string when it does not, so a route that only ever parsed would refuse every
 * caller that set the header — and one that never parsed would refuse every caller that
 * did not.
 */
const sentSettings = (body: unknown): Record<string, any> =>
  typeof body === 'string' ? JSON.parse(body) : (body as Record<string, any>)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    if (skipFirebase) {
      if (req.method === 'GET') {
        res.status(200).json(localSpaceSettings)
      } else {
        const { pluginId, spaceId, ...settings } = sentSettings(req.body)

        Object.assign(localSpaceSettings, settings)
        res.status(200).end()
      }

      return res.end()
    }

    if (req.method === 'POST') {
      // Whatever settings the caller sent, named or not: the storage SDK writes each field
      // whole and leaves the rest alone, so a request carrying one setting cannot disturb
      // another. Naming them here would put every new setting through this file.
      const { pluginId, spaceId, ...settings } = sentSettings(req.body)

      await saveSpaceSettings({ pluginId, spaceId, ...settings })

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

    // `JSON.stringify` of an Error is `{}`, so sending the error itself told the caller
    // nothing at all.
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Could not reach the settings store',
    })
    res.end()
  }
}
