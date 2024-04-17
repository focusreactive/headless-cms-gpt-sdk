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
import { language } from '@src/context/AppDataContext'

export type FieldTranslation = {
  targetLanguage: string
  targetLanguageCode: string
  targetLanguageName: string
}

export type FolderTranslation = FolderTranslationData & {
  userTypedLanguage: string
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
  | { type: 'loadingEnded' }
  | { type: 'endedSuccessfully'; payload: string }

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
          isReadyToPerformLocalization: !state.isLoading && !!targetLanguage,
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
      const isFolderLevel = translationLevel === 'folder'
      const isFieldLevel = translationLevel === 'field'
      const userTypedLanguage = state.folderLevelTranslation.userTypedLanguage
      const targetLanguageCode = state.fieldLevelTranslation.targetLanguageCode

      return {
        ...state,
        translationLevel,
        targetLanguageCode: isFieldLevel
          ? targetLanguageCode
          : userTypedLanguage,
        targetLanguageName: isFieldLevel
          ? state.fieldLevelTranslation.targetLanguageName
          : userTypedLanguage,
        isReadyToPerformLocalization:
          !state.isLoading &&
          ((targetLanguageCode && isFieldLevel) ||
            (state.folderLevelTranslation.targetFolderId &&
              userTypedLanguage &&
              isFolderLevel)),
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
          isReadyToPerformLocalization:
            !state.isLoading &&
            !!targetFolderId &&
            !!state.folderLevelTranslation.userTypedLanguage,
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
          isReadyToPerformLocalization:
            !state.isLoading &&
            !!userTypedLanguage &&
            !!state.folderLevelTranslation.targetFolderId,
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
        isReadyToPerformLocalization: false,
      }

    case 'loadingEnded':
      return {
        ...state,
        isLoading: false,
        isReadyToPerformLocalization:
          (state.fieldLevelTranslation.targetLanguage &&
            state.translationLevel === 'field') ||
          ((state.folderLevelTranslation.targetFolderId ||
            state.folderLevelTranslation.userTypedLanguage) &&
            state.translationLevel === 'folder'),
      }

    case 'endedSuccessfully':
      return {
        ...INITIAL_STATE,
        successMessage: action.payload,
      }
  }
}

const Localization = () => {
  const [state, dispatch] = React.useReducer(reducer, INITIAL_STATE)

  const cratePageContext = async () => {
    await summariseStory({
      contentTitle: 'Website page',
      promptModifier: 'Summary should be short and concise.',
      cb: (summary) => dispatch({ type: 'setStorySummary', payload: summary }),
    })
  }

  const localize = async () => {
    dispatch({ type: 'loadingStarted' })

    await cratePageContext()

    await localizeStory({
      targetLanguageCode: state.targetLanguageCode,
      targetLanguageName: state.targetLanguageName,
      folderLevelTranslation: state.folderLevelTranslation,
      mode: 'update',
      promptModifier: state.storySummary
        ? `Use this text as a context, do not add it to the result translation: "${state.storySummary}"`
        : '',
      cb: () => {
        dispatch({
          type: 'endedSuccessfully',
          payload: 'Success! Change the language to see the localized content.',
        })
      },
      translationLevel: state.translationLevel,
    })
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
