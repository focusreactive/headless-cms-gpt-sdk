import { Typography } from '@mui/material'
import React from 'react'
import {
  FolderTranslationData,
  localizeStory,
  summariseStory,
  TRANSLATION_LEVELS,
  TranslationLevels,
  TranslationModes,
} from '@focus-reactive/storyblok-ai-sdk'
import LocalizeStoryMode from './modes/Story'
import { AppDataContext, language } from '@src/context/AppDataContext'
import { PLUGIN_ID } from '@src/constants'

const Localization = () => {
  const [state, dispatch] = React.useReducer(mainReducer, INITIAL_STATE)
  const { spaceId, userId } = React.useContext(AppDataContext)

  React.useEffect(() => {
    fetch(`/api/space-settings?spaceId=${spaceId}`, {
      method: 'GET',
    })
      .then((data) => data.json())
      .then(
        (spaceSettings) =>
          spaceSettings.notTranslatableWords &&
          dispatch({
            type: 'setNotTranslatableWords',
            payload: spaceSettings.notTranslatableWords,
          }),
      )
  }, [])

  const cratePageContext = async () => {
    await summariseStory({
      contentTitle: 'Website page',
      promptModifier: 'Summary should be short and concise.',
      cb: (summary) => dispatch({ type: 'setStorySummary', payload: summary }),
    })
  }

  const localize = async () => {
    dispatch({ type: 'loadingStarted' })

    const notTranslatableWords = Array.from(state.notTranslatableWords.set)

    await fetch(`/api/space-settings`, {
      method: 'POST',
      body: JSON.stringify({
        spaceId,
        pluginId: PLUGIN_ID,
        notTranslatableWords: {
          limit: state.notTranslatableWords.limit,
          set: notTranslatableWords,
        },
      }),
    })

    const response = await fetch(`/api/usage?spaceId=${spaceId}`)
    const { isUseAllowed } = await response.json()

    if (isUseAllowed) {
      let errorMessage = ''
      try {
        await cratePageContext()
        await localizeStory({
          targetLanguageCode: state.targetLanguageCode,
          targetLanguageName: state.targetLanguageName,
          folderLevelTranslation: state.folderLevelTranslation,
          mode: 'update',
          promptModifier: state.storySummary
            ? `Use this text as a context, do not add it to the result translation: "${state.storySummary}"`
            : '',
          cb: () =>
            dispatch({
              type: 'endedSuccessfully',
              payload:
                'Success! Change the language to see the localized content.',
            }),
          translationLevel: state.translationLevel,
          notTranslatableWords,
        })
      } catch (error) {
        errorMessage = error.message

        dispatch({
          type: 'endedSuccessfully',
          payload: errorMessage,
        })
      } finally {
        saveEvent({
          spaceId,
          userId,
          errorMessage,
          eventName:
            state.translationLevel === 'folder'
              ? 'folderLevelTranslation'
              : 'fieldLevelTranslation',
        })
      }
    } else {
      dispatch({
        type: 'endedSuccessfully',
        payload: 'You have reached your free limit, please contact us',
      })
    }
  }

  return (
    <div>
      <Typography variant="h1">Localization</Typography>

      <LocalizeStoryMode
        localize={localize}
        translationLevels={TRANSLATION_LEVELS}
        dispatch={dispatch}
        state={state}
      />
    </div>
  )
}

export default Localization

export type FieldTranslation = {
  targetLanguage: string
  targetLanguageCode: string
  targetLanguageName: string
}

export type FolderTranslation = FolderTranslationData & {
  userTypedLanguage: string
}

type NotTranslatableWords = {
  set: Set<string>
  new: string | null
  limit: number | null
}

export type LocalizationState = {
  fieldLevelTranslation: FieldTranslation
  folderLevelTranslation: FolderTranslation
  isLoading: boolean
  successMessage: string
  storySummary: string
  translationLevel: TranslationLevels
  isReadyToPerformLocalization: boolean
  targetLanguageCode: string
  targetLanguageName: string
  notTranslatableWords: NotTranslatableWords
}

const INITIAL_STATE: LocalizationState = {
  fieldLevelTranslation: {
    targetLanguageCode: '',
    targetLanguageName: '',
    targetLanguage: '',
  },
  folderLevelTranslation: {
    targetFolderId: 0,
    userTypedLanguage: '',
    translationMode: 'selected',
  },
  targetLanguageCode: '',
  targetLanguageName: '',
  isLoading: false,
  successMessage: '',
  storySummary: '',
  translationLevel: 'field',
  isReadyToPerformLocalization: false,
  notTranslatableWords: { set: new Set(), new: null, limit: 10 },
}

export type LocalizationAction =
  | {
      type: 'setTargetLanguage'
      payload: { language: string; languages: language[] }
    }
  | { type: 'setSuccessMessage'; payload: string }
  | { type: 'setStorySummary'; payload: string }
  | { type: 'setTranslationLevel'; payload: TranslationLevels }
  | { type: 'setTargetFolderId'; payload: number | string }
  | { type: 'setUserTypedLanguage'; payload: string }
  | { type: 'setTranslationMode'; payload: TranslationModes }
  | { type: 'loadingStarted' }
  | { type: 'endedSuccessfully'; payload: string }
  | { type: 'endedWithError'; payload: string }
  | { type: 'addNotTranslatableWord' }
  | { type: 'setNewNotTranslatableWord'; payload: string }
  | { type: 'setNotTranslatableWords'; payload: NotTranslatableWords }

const reducer = (
  state: LocalizationState,
  action: LocalizationAction,
): LocalizationState => {
  switch (action.type) {
    case 'setTargetLanguage':
      if (state.translationLevel === 'field') {
        const targetLanguage = action.payload.language
        const targetLanguageCode = targetLanguage.replace('-', '_')

        const targetLanguageName =
          action.payload.languages.find((lang) => lang.code === targetLanguage)
            ?.name || ''

        return {
          ...state,
          fieldLevelTranslation: {
            ...state.fieldLevelTranslation,
            targetLanguage,
            targetLanguageCode,
            targetLanguageName,
          },
          targetLanguageCode,
          targetLanguageName,
        }
      }

      return state

    case 'setSuccessMessage':
      return {
        ...state,
        successMessage: action.payload,
      }

    case 'setStorySummary':
      return {
        ...state,
        storySummary: action.payload,
      }

    case 'setTranslationLevel': {
      const translationLevel = action.payload
      const isFieldLevel = translationLevel === 'field'
      const userTypedLanguage = state.folderLevelTranslation.userTypedLanguage

      return {
        ...state,
        translationLevel,
        targetLanguageCode: isFieldLevel
          ? state.fieldLevelTranslation.targetLanguageCode
          : userTypedLanguage,
        targetLanguageName: isFieldLevel
          ? state.fieldLevelTranslation.targetLanguageName
          : userTypedLanguage,
      }
    }

    case 'setTargetFolderId':
      if (state.translationLevel === 'folder') {
        const targetFolderId = action.payload

        return {
          ...state,
          folderLevelTranslation: {
            ...state.folderLevelTranslation,
            targetFolderId,
          },
        }
      }

      return state

    case 'setUserTypedLanguage':
      if (state.translationLevel === 'folder') {
        const userTypedLanguage = action.payload

        return {
          ...state,
          folderLevelTranslation: {
            ...state.folderLevelTranslation,
            userTypedLanguage,
          },
          targetLanguageCode: userTypedLanguage,
          targetLanguageName: userTypedLanguage,
        }
      }

      return state

    case 'setTranslationMode':
      if (state.translationLevel === 'folder') {
        return {
          ...state,
          folderLevelTranslation: {
            ...state.folderLevelTranslation,
            translationMode: action.payload,
          },
        }
      }

      return state

    case 'loadingStarted':
      return {
        ...state,
        isLoading: true,
        successMessage: '',
      }

    case 'addNotTranslatableWord':
      if (state.notTranslatableWords.new) {
        const updatedListOfWords = [
          ...Array.from(state.notTranslatableWords.set),
          state.notTranslatableWords.new,
        ]

        return {
          ...state,
          notTranslatableWords: {
            ...state.notTranslatableWords,
            set: new Set(updatedListOfWords),
          },
        }
      }

      return state

    case 'setNewNotTranslatableWord':
      return {
        ...state,
        notTranslatableWords: {
          ...state.notTranslatableWords,
          new: action.payload,
        },
      }

    case 'setNotTranslatableWords':
      return {
        ...state,
        notTranslatableWords: {
          ...state.notTranslatableWords,
          ...action.payload,
          set: new Set(action.payload.set),
        },
      }

    case 'endedSuccessfully':
      return {
        ...INITIAL_STATE,
        successMessage: action.payload,
        notTranslatableWords: {
          ...state.notTranslatableWords,
        },
      }
  }
}

const mainReducer = (
  state: LocalizationState,
  action: LocalizationAction,
): LocalizationState => {
  const newState = reducer(state, action)

  if (newState.isLoading) {
    return { ...newState, isReadyToPerformLocalization: false }
  }

  if (
    newState.translationLevel === 'field' &&
    !newState.fieldLevelTranslation.targetLanguageCode
  ) {
    return { ...newState, isReadyToPerformLocalization: false }
  }

  const isFolderTranslationDataReady =
    newState.folderLevelTranslation.targetFolderId &&
    newState.folderLevelTranslation.userTypedLanguage

  if (newState.translationLevel === 'folder' && !isFolderTranslationDataReady) {
    return { ...newState, isReadyToPerformLocalization: false }
  }

  return {
    ...newState,
    isReadyToPerformLocalization: true,
  }
}
async function saveEvent({ spaceId, userId, errorMessage, eventName }) {
  await fetch('/api/usage', {
    method: 'POST',
    body: JSON.stringify({
      eventName,
      pluginId: PLUGIN_ID,
      spaceId,
      userId,
      errorMessage,
    }),
  })
}
