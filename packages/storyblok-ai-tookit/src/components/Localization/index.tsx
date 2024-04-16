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
  const [targetFolder, setTargetFolder] = React.useState(null)
  const { languages, folders } = React.useContext(AppDataContext)
  const [userTypedLanguage, setUserTypedLanguage] = React.useState(null)
  const [translationMode, setTranslationMode] = React.useState(null)
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
      level:
        translationLevel === 'field'
          ? { type: 'field' }
          : {
              type: 'folder',
              targetFolder,
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
        targetFolder={targetFolder}
        setTargetFolder={setTargetFolder}
        setUserTypedLanguage={setUserTypedLanguage}
        userTypedLanguage={userTypedLanguage}
        setTranslationMode={setTranslationMode}
      />
    </div>
  )
}

export default Localization
