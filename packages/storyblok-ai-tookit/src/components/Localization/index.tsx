import { Typography } from '@mui/material'
import React from 'react'
import { localizeStory, summariseStory } from '@focus-reactive/storyblok-ai-sdk'
import LocalizeStoryMode from './modes/Story'
import { AppDataContext } from '@src/context/AppDataContext'
import { PLUGIN_ID } from '@src/constants'

async function saveEvent({ spaceId, userId, errorMessage }) {
  await fetch('/api/usage', {
    method: 'POST',
    body: JSON.stringify({
      eventName: 'fieldLevelTranslation',
      pluginId: PLUGIN_ID,
      spaceId,
      userId,
      errorMessage,
    }),
  })
}

const Localization = () => {
  const [targetLanguage, setTargetLanguage] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [successMessage, setSuccessMessage] = React.useState<string>('')
  const [storySummary, setStorySummary] = React.useState<string>('')
  const { languages, spaceId, userId } = React.useContext(AppDataContext)
  const spaceLanguages = languages || []

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

    const isUseAllowed = await fetch(`/api/usage?spaceId=${spaceId}`)

    if (isUseAllowed) {
      let errorMessage = ''

      try {
        await cratePageContext()
        await localizeStory({
          targetLanguageCode: targetLanguage.replace('-', '_'),
          targetLanguageName:
            spaceLanguages.find((lang) => lang.code === targetLanguage)?.name ||
            '',
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
        })
      } catch (error) {
        errorMessage = error.message
      } finally {
        saveEvent({ spaceId, userId, errorMessage })
      }
    } else {
      setIsLoading(false)
    }
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
      />
    </div>
  )
}

export default Localization
