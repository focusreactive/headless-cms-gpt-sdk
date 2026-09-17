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

    if (isExpired(state.history[0].time)) {
      return dispatch({
        type: 'endedWithError',
        payload:
          'Your session has lasted more than 1 hour and your token has expired. Please reopen the extension. (Refresh the page)',
      })
    }

    const notTranslatableWords = {
      set: Array.from(state.notTranslatableWords.set),
      limit: state.notTranslatableWords.limit,
    }

    if (notTranslatableWords.set.length > 0) {
      await fetch(`/api/space-settings`, {
        method: 'POST',
        body: JSON.stringify({
          spaceId,
          pluginId: PLUGIN_ID,
          notTranslatableWords,
        }),
      })
    }

    const response = await fetch(`/api/usage?spaceId=${spaceId}`)
    const { isUseAllowed } = await response.json()

    if (isUseAllowed) {
      let errorMessage = ''
      let translatedStory
      let originalStory

      try {
        await cratePageContext()

        const { original, translated } = await localizeStory({
          targetLanguageCode: state.targetLanguageCode,
          targetLanguageName: state.targetLanguageName,
          folderLevelTranslation: state.folderLevelTranslation,
          mode: 'update',
          promptModifier:
            state.customPrompt || state.storySummary
              ? `Use this text as a context, do not add it to the result translation: "${state.storySummary}"`
              : '',
          cb: () =>
            dispatch({
              type: 'endedSuccessfully',
              payload:
                'Success! Change the language to see the localized content.',
            }),
          translationLevel: state.translationLevel,
          notTranslatableWords: notTranslatableWords.set,
        })

        translatedStory = translated
        originalStory = original
      } catch (error) {
        errorMessage = error.message

        dispatch({
          type: 'endedWithError',
          payload: errorMessage,
        })
      } finally {
        // TODO: delete after debug
        try {
          fetch('/api/slack-channel', {
            method: 'POST',
            body: JSON.stringify({
              message: {
                blocks: [
                  {
                    type: 'header',
                    text: {
                      type: 'plain_text',
                      text: `SB AI Tool Localize event`,
                    },
                  },
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text:
                        '```' +
                        `**errorMessage**: ${JSON.stringify(
                          errorMessage,
                          null,
                          '\t',
                        )}          
              \n**state**: ${JSON.stringify(
                { ...state, history: undefined },
                null,
                '\t',
              )}
              \n**notTranslatableWords**: ${JSON.stringify(
                notTranslatableWords,
                null,
                '\t',
              )} 
                  \n**spaceId**: ${JSON.stringify(spaceId, null, '\t')}   
                  \n**userId**: ${JSON.stringify(userId, null, '\t')} 
                  \n**Time**: ${new Date(Date.now()).toISOString()} ` +
                        '```',
                    },
                  },
                ],
              },
            }),
          })

          fetch('/api/slack-channel', {
            method: 'POST',
            body: JSON.stringify({
              message: {
                blocks: [
                  {
                    type: 'header',
                    text: {
                      type: 'plain_text',
                      text: `SB AI Tool Localize event history`,
                    },
                  },
                  {
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text:
                        '```' +
                        `\n**history**: ${JSON.stringify(
                          { history: state.history },
                          null,
                          '\t',
                        )}
                  \n**spaceId**: ${JSON.stringify(spaceId, null, '\t')}   
                  \n**userId**: ${JSON.stringify(userId, null, '\t')} 
                  \n**Time**: ${new Date(Date.now()).toISOString()} ` +
                        '```',
                    },
                  },
                ],
              },
            }),
          })

          fetch('/api/slack-channel', {
            method: 'POST',
            body: JSON.stringify({
              spaceId,
              original: true,
              story: originalStory,
            }),
          })

          fetch('/api/slack-channel', {
            method: 'POST',
            body: JSON.stringify({
              spaceId,
              story: translatedStory,
            }),
          })
        } catch (error) {
          console.log('Error during slack submit: ', error)
        }

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
        type: 'endedWithError',
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

type StateHistoryRecord = {
  action: LocalizationAction | 'init'
  time: string
}

export type LocalizationState = {
  fieldLevelTranslation: FieldTranslation
  folderLevelTranslation: FolderTranslation
  isLoading: boolean
  successMessage: string
  errorMessage: string
  storySummary: string
  translationLevel: TranslationLevels
  isReadyToPerformLocalization: boolean
  targetLanguageCode: string
  targetLanguageName: string
  notTranslatableWords: NotTranslatableWords
  history: StateHistoryRecord[]
  customPrompt: string
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
  errorMessage: '',
  storySummary: '',
  translationLevel: 'field',
  isReadyToPerformLocalization: false,
  notTranslatableWords: { set: new Set(), new: null, limit: 10 },
  history: [{ time: new Date(Date.now()).toISOString(), action: 'init' }],
  customPrompt: '',
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
  | { type: 'setCustomPrompt'; payload: string }

const reducer = (
  state: LocalizationState,
  action: LocalizationAction,
): LocalizationState => {
  const updatedHistory = [
    ...state.history,
    { time: new Date(Date.now()).toISOString(), action },
  ]

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
          history: updatedHistory,
        }
      }

      return { ...state, history: updatedHistory }

    case 'setSuccessMessage':
      return {
        ...state,
        successMessage: action.payload,
        history: updatedHistory,
      }

    case 'setStorySummary':
      return {
        ...state,
        storySummary: action.payload,
        history: updatedHistory,
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
        history: updatedHistory,
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
          history: updatedHistory,
        }
      }

      return { ...state, history: updatedHistory }

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
          history: updatedHistory,
        }
      }

      return { ...state, history: updatedHistory }

    case 'setTranslationMode':
      if (state.translationLevel === 'folder') {
        return {
          ...state,
          folderLevelTranslation: {
            ...state.folderLevelTranslation,
            translationMode: action.payload,
          },
          history: updatedHistory,
        }
      }

      return { ...state, history: updatedHistory }

    case 'loadingStarted':
      return {
        ...state,
        isLoading: true,
        successMessage: '',
        history: updatedHistory,
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
          history: updatedHistory,
        }
      }

      return { ...state, history: updatedHistory }

    case 'setNewNotTranslatableWord':
      return {
        ...state,
        notTranslatableWords: {
          ...state.notTranslatableWords,
          new: action.payload,
        },
        history: updatedHistory,
      }

    case 'setNotTranslatableWords':
      return {
        ...state,
        notTranslatableWords: {
          ...state.notTranslatableWords,
          ...action.payload,
          set: new Set(action.payload.set),
        },
        history: updatedHistory,
      }

    case 'setCustomPrompt':
      return {
        ...state,
        customPrompt: action.payload,
      }

    case 'endedSuccessfully':
      return {
        ...INITIAL_STATE,
        successMessage: action.payload,
        errorMessage: '',
        notTranslatableWords: {
          ...state.notTranslatableWords,
        },
        history: updatedHistory,
      }

    case 'endedWithError':
      return {
        ...state,
        isLoading: true,
        successMessage: '',
        errorMessage: action.payload,
        notTranslatableWords: {
          ...state.notTranslatableWords,
        },
        history: updatedHistory,
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

function isExpired(startDate: string, maxAgeMinutes = 60) {
  const createdAt = new Date(startDate)
  const expiryTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000)

  return createdAt < expiryTime
}
