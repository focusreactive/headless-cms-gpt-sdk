import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import React from 'react'
import { localizeStory, summariseStory } from '@focus-reactive/storyblok-ai-sdk'
import { translate } from '@focus-reactive/content-ai-sdk'
import LocalizeStoryMode from './modes/Story'
import LocalizeTextMode from './modes/Text'

type Feature = {
  id: string
  title: string
}

const MODE: Feature[] = [
  {
    id: 'story',
    title: 'Story',
  },
  {
    id: 'text',
    title: 'Text',
  },
]

const Localization = () => {
  const [activeMode, setActiveMode] = React.useState<string>(MODE[0].id)
  const [targetLanguage, setTargetLanguage] = React.useState<string>('')
  const [isLoading, setIsLoading] = React.useState<boolean>(false)
  const [successMessage, setSuccessMessage] = React.useState<string>('')
  const [stringToTranslate, setStringToTranslate] = React.useState<string>('')
  const [translatedString, setTranslatedString] = React.useState<string>('')
  const [storySummary, setStorySummary] = React.useState<string>('')

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
      targetLanguage,
      hasToCreateNewStory: true,
      promptModifier: storySummary
        ? `Use this text as a context, do not add it to the result translation: "${storySummary}"`
        : '',
      cb: () => {
        setIsLoading(false)
        setTargetLanguage('')
        setSuccessMessage(
          'Success! Please find your story on a same folder lvl',
        )
      },
    })
  }

  const translateString = async () => {
    setIsLoading(true)
    setSuccessMessage('')

    await cratePageContext()

    const transaltedContent = await translate({
      targetLanguage,
      content: stringToTranslate,
      promptModifier: storySummary
        ? `Use this text as a context, do not add it to the result translation: "${storySummary}"`
        : '',
    })

    setTranslatedString(transaltedContent)
    setIsLoading(false)

    setSuccessMessage('Done! Please find your translated text below.')
  }

  return (
    <div>
      <Typography variant="h1">Localization</Typography>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '-14px 0 8px 0',
          padding: '0 2px',
        }}
      >
        <RadioGroup
          color="inherit"
          row
        >
          {MODE.map((mode) => (
            <FormControlLabel
              control={<Radio />}
              key={mode.id}
              checked={activeMode === mode.id}
              onClick={() => {
                setActiveMode(mode.id)
              }}
              label={mode.title}
            />
          ))}
        </RadioGroup>
      </div>
      {activeMode === MODE[0].id && (
        <LocalizeStoryMode
          targetLanguage={targetLanguage}
          isLoading={isLoading}
          setTargetLanguage={setTargetLanguage}
          localize={localize}
          successMessage={successMessage}
        />
      )}
      {activeMode === MODE[1].id && (
        <LocalizeTextMode
          targetLanguage={targetLanguage}
          isLoading={isLoading}
          setTargetLanguage={setTargetLanguage}
          setStringToTranslate={setStringToTranslate}
          successMessage={successMessage}
          stringToTranslate={stringToTranslate}
          setSuccessMessage={setSuccessMessage}
          translateString={translateString}
          translatedString={translatedString}
        />
      )}
    </div>
  )
}

export default Localization
