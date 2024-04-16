import { Typography } from '@mui/material'
import React from 'react'
import { localizeStory, summariseStory } from '@focus-reactive/storyblok-ai-sdk'
import LocalizeStoryMode from './modes/Story'
import { AppDataContext } from '@src/context/AppDataContext'

const Localization = () => {
  const [targetLanguage, setTargetLanguage] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [successMessage, setSuccessMessage] = React.useState<string>('')
  const [storySummary, setStorySummary] = React.useState<string>('')
  const [translationLevel, setTranslationLevel] = React.useState('field')
  const [targetFolderId, setTargetFolderId] = React.useState(null)
  const [userTypedLanguage, setUserTypedLanguage] = React.useState(null)
  const [translationMode, setTranslationMode] = React.useState(null)
  const { languages } = React.useContext(AppDataContext)
  const translationLevels = ['field', 'folder']

  const cratePageContext = async () => {
    await summariseStory({
      contentTitle: 'Website page',
      promptModifier: 'Summary should be short and concise.',
      cb: (summary) => {
        setStorySummary(summary)
      },
    })
  }

  const localize = async () => {
    setIsLoading(true)
    setSuccessMessage('')

    await cratePageContext()

    await localizeStory({
      targetLanguageCode:
        translationLevel === 'field'
          ? targetLanguage.replace('-', '_')
          : userTypedLanguage,
      targetLanguageName:
        translationLevel === 'field'
          ? languages.find((lang) => lang.code === targetLanguage)?.name || ''
          : userTypedLanguage,
      mode: 'update',
      promptModifier: storySummary
        ? `Use this text as a context, do not add it to the result translation: "${storySummary}"`
        : '',
      cb: () => {
        setIsLoading(false)
        setTargetLanguage('')
        setSuccessMessage(
          'Success! Change the language to see the localized content.',
        )
      },
      translationLevel:
        translationLevel === 'field'
          ? { type: 'field' }
          : {
              type: 'folder',
              targetFolderId,
            },
      translationMode,
    })
  }

  return (
    <div>
      <Typography variant="h1">Localization</Typography>

      <LocalizeStoryMode
        targetLanguage={targetLanguage}
        isLoading={isLoading}
        setTargetLanguage={setTargetLanguage}
        localize={localize}
        successMessage={successMessage}
        setTranslationLevel={setTranslationLevel}
        translationLevels={translationLevels}
        translationLevel={translationLevel}
        targetFolderId={targetFolderId}
        setTargetFolderId={setTargetFolderId}
        setUserTypedLanguage={setUserTypedLanguage}
        userTypedLanguage={userTypedLanguage}
        setTranslationMode={setTranslationMode}
      />
    </div>
  )
}

export default Localization
