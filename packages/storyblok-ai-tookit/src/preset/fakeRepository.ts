import type { ApiError } from '../shared/apiError'
import { overStorage } from './overStorage'
import type { CreateFakeRepository } from './presetStore.types'

const after = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve()

export const createFakeRepository: CreateFakeRepository = (document) => {
  let held: unknown = document
  let delay = 0
  let loadFailure: ApiError | null = null
  let saveFailure: ApiError | null = null

  return {
    repository: overStorage({
      read: async () => {
        const failure = loadFailure
        loadFailure = null

        await after(delay)

        if (failure !== null) {
          throw failure
        }

        return held
      },

      write: async (written) => {
        const failure = saveFailure
        saveFailure = null

        await after(delay)

        if (failure !== null) {
          throw failure
        }

        held = written
      },
    }),

    control: {
      held: () => held,
      setDelay: (ms) => {
        delay = ms
      },
      failNextLoad: (error) => {
        loadFailure = error
      },
      failNextSave: (error) => {
        saveFailure = error
      },
    },
  }
}
