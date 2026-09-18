import { toSettings, toStored } from './presetDto'
import type { OverStorage } from './presetStore.types'

export const overStorage: OverStorage = (io) => ({
  load: async () => toSettings(await io.read()),
  save: (settings) => io.write(toStored(settings)),
})
