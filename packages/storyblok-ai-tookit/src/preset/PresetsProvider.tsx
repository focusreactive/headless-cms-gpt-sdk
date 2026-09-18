import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import type { ApiError } from '../shared/apiError'
import type { StyleSettings } from './preset.types'
import {
  removePreset as removeFromSettings,
  savePreset as saveIntoSettings,
  setDefaultPreset as setDefaultInSettings,
} from './presetSet'
import type {
  MutationState,
  Presets,
  PresetRepository,
  PresetsState,
  Written,
} from './presetStore.types'

type PresetsProviderProps = {
  repository: PresetRepository
  children: ReactNode
}

const PresetsContext = createContext<Presets | null>(null)

export const PresetsProvider = ({ repository, children }: PresetsProviderProps) => {
  const [presets, setPresets] = useState<PresetsState>({ kind: 'loading' })
  const [mutation, setMutation] = useState<MutationState>({ kind: 'idle' })

  // Read where a decision is made rather than where a render happens: refusing a second
  // call has to see the first one's flight, which state would only report a render later.
  const held = useRef(presets)
  held.current = presets

  const busy = useRef(false)
  const alive = useRef(true)
  const repositoryRef = useRef(repository)

  useEffect(() => {
    alive.current = true

    return () => {
      alive.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    if (busy.current) {
      return
    }

    busy.current = true
    setPresets({ kind: 'loading' })

    try {
      const settings = await repositoryRef.current.load()

      if (alive.current) {
        setPresets({ kind: 'ready', settings })
      }
    } catch (error) {
      if (alive.current) {
        setPresets({ kind: 'failed', error: error as ApiError })
      }
    } finally {
      busy.current = false
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const operate = useCallback(
    async (apply: (settings: StyleSettings) => StyleSettings): Promise<Written> => {
      if (busy.current || held.current.kind !== 'ready') {
        return 'refused'
      }

      const settings = apply(held.current.settings)

      if (settings === held.current.settings) {
        return 'unchanged'
      }

      busy.current = true
      setMutation({ kind: 'saving' })

      try {
        await repositoryRef.current.save(settings)

        if (alive.current) {
          setPresets({ kind: 'ready', settings })
          setMutation({ kind: 'idle' })
        }

        return 'written'
      } catch (error) {
        if (alive.current) {
          setMutation({ kind: 'failed', error: error as ApiError })
        }

        return 'failed'
      } finally {
        busy.current = false
      }
    },
    [],
  )

  const value = useMemo<Presets>(
    () => ({
      presets,
      mutation,
      reload,
      savePreset: (draft) => operate((settings) => saveIntoSettings(settings, draft)),
      removePreset: (id) => operate((settings) => removeFromSettings(settings, id)),
      setDefaultPreset: (id) => operate((settings) => setDefaultInSettings(settings, id)),
    }),
    [presets, mutation, reload, operate],
  )

  return <PresetsContext.Provider value={value}>{children}</PresetsContext.Provider>
}

export const usePresets = (): Presets => {
  const value = useContext(PresetsContext)

  if (value === null) {
    throw new Error('usePresets was called outside a PresetsProvider')
  }

  return value
}
