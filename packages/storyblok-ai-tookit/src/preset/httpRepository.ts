import { PLUGIN_ID } from '../constants'
import { ApiError } from '../shared/apiError'
import { overStorage } from './overStorage'
import type { CreateHttpRepository, StorageIO } from './presetStore.types'

const ROUTE = '/api/space-settings'

const FIELD = 'stylePresets'

const sent = async (url: string, init?: RequestInit): Promise<Response> => {
  let response: Response

  try {
    response = await fetch(url, init)
  } catch (error) {
    throw new ApiError('network', `${init?.method ?? 'GET'} ${url} got no response`)
  }

  if (!response.ok) {
    throw new ApiError(
      'http',
      `${init?.method ?? 'GET'} ${url} answered ${response.status}`,
      response.status,
    )
  }

  return response
}

const documentOf = async (response: Response): Promise<unknown> => {
  let body: string

  try {
    body = await response.text()
  } catch (error) {
    throw new ApiError('malformed', `${ROUTE} answered with a body that could not be read`)
  }

  // A success carrying nothing is a space nothing has ever written: the route answers a
  // space it has no settings for with `res.json(undefined)`, which sends an empty body.
  // Nothing went wrong, so this is not `malformed`.
  if (body.trim() === '') {
    return undefined
  }

  try {
    return JSON.parse(body)
  } catch (error) {
    throw new ApiError('malformed', `${ROUTE} answered with a body that is not JSON`)
  }
}

const fieldOf = (document: unknown): unknown =>
  typeof document === 'object' && document !== null
    ? (document as Record<string, unknown>)[FIELD]
    : undefined

const overRoute = (spaceId: number): StorageIO => ({
  read: async () =>
    fieldOf(await documentOf(await sent(`${ROUTE}?spaceId=${spaceId}`))),

  write: async (document) => {
    await sent(ROUTE, {
      method: 'POST',
      body: JSON.stringify({ spaceId, pluginId: PLUGIN_ID, [FIELD]: document }),
    })
  },
})

export const createHttpRepository: CreateHttpRepository = (spaceId) =>
  overStorage(overRoute(spaceId))
