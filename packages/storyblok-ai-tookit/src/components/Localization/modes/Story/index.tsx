import {
  Button,
  FormControl,
  FormLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material'
import { AppDataContext } from '@src/context/AppDataContext'
import React, { Dispatch } from 'react'
import { LocalizationAction, LocalizationState } from '../..'
import {
  TranslationLevels,
  TranslationModes,
} from '@focus-reactive/storyblok-ai-sdk'

interface ILocalizeStoryModeProps {
  localize: () => void
  translationLevels: string[]
  state: LocalizationState
  dispatch: Dispatch<LocalizationAction>
}

const LocalizeStoryMode: React.FC<ILocalizeStoryModeProps> = ({
  localize,
  translationLevels,
  state,
  dispatch,
}) => {
  const { languages, folders } = React.useContext(AppDataContext)

  React.useEffect(() => {
    if (languages.length > 0) {
      dispatch({
        type: 'setTargetLanguage',
        payload: { language: languages[0].code, languages },
      })
    }
  }, [])

  return (
    <>
      <Typography variant="body1">
        Hey! Please select your target language and click the button. We will
        update the page with translations for it.
      </Typography>
      <div style={{ margin: '12px 0 20px', padding: '0 4px' }}>
        <FormControl fullWidth>
          <FormLabel>Translation level</FormLabel>
          <Select
            labelId="translation-level-select-label"
            id="translation-level-select"
            value={state.translationLevel}
            label="Translation level"
            onChange={(e) =>
              dispatch({
                type: 'setTranslationLevel',
                payload: e.target.value as TranslationLevels,
              })
            }
          >
            {translationLevels.map((level) => (
              <MenuItem
                key={level}
                value={level}
              >
                {level}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
      {state.translationLevel === 'field' && (
        <div style={{ margin: '12px 0 20px', padding: '0 4px' }}>
          <FormControl fullWidth>
            <FormLabel>Target language</FormLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={state.fieldLevelTranslation.targetLanguage}
              label="Age"
              onChange={(e) =>
                dispatch({
                  type: 'setTargetLanguage',
                  payload: { language: e.target.value, languages },
                })
              }
            >
              {languages.map((language) => (
                <MenuItem
                  key={language.code}
                  value={language.code}
                >
                  {language.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      )}
      {state.translationLevel === 'folder' && (
        <div style={{ margin: '12px 0 20px', padding: '0 4px' }}>
          <FormControl fullWidth>
            <FormLabel>Please select language folder</FormLabel>
            <Select
              labelId="language-folder-select-label"
              id="language-folder-select"
              value={state.folderLevelTranslation.targetFolderId}
              label="Language folder"
              onChange={(e) =>
                dispatch({ type: 'setTargetFolderId', payload: e.target.value })
              }
            >
              {folders.map((folder) => (
                <MenuItem
                  key={folder.name}
                  value={folder.id}
                >
                  {folder.name}
                </MenuItem>
              ))}
            </Select>
            <FormLabel>Please type language</FormLabel>
            <TextField
              value={state.folderLevelTranslation.userTypedLanguage}
              onChange={(e) =>
                dispatch({
                  type: 'setUserTypedLanguage',
                  payload: e.target.value,
                })
              }
            />
            <RadioGroup
              aria-labelledby="translation-mode-radio-buttons-group-label"
              defaultValue="selected"
              name="radio-buttons-group"
              onChange={(e) =>
                dispatch({
                  type: 'setTranslationMode',
                  payload: e.target.value as TranslationModes,
                })
              }
            >
              <FormControlLabel
                value="selected"
                control={<Radio defaultChecked />}
                label="Translate fields marked as translatable"
              />
              <FormControlLabel
                value="all"
                control={<Radio />}
                label="All"
              />
            </RadioGroup>
          </FormControl>
        </div>
      )}
      <Button
        fullWidth
        disabled={!state.isReadyToPerformLocalization}
        onClick={localize}
      >
        {state.isLoading ? 'Localizing...' : 'Localize'}
      </Button>
      {state.isLoading && (
        <Typography
          variant="body2"
          textAlign="center"
        >
          Usually it takes 1min max to localize a story.
        </Typography>
      )}
      {state.successMessage && (
        <Typography
          variant="body1"
          fontWeight={700}
          margin="20px 0 0"
          textAlign="center"
        >
          {state.successMessage}
        </Typography>
      )}
    </>
  )
}

export default LocalizeStoryMode
