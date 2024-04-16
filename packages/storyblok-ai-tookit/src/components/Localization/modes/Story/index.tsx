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
import React from 'react'

interface ILocalizeStoryModeProps {
  targetLanguage: string
  setTargetLanguage: (value: string) => void
  isLoading: boolean
  localize: () => void
  successMessage: string
  translationLevels: string[]
  setTranslationLevel: (value: string) => void
  translationLevel: string
  targetFolderId: string
  setTargetFolderId: (value: string) => void
  setUserTypedLanguage: (value: string) => void
  userTypedLanguage: string
  setTranslationMode: (value: string) => void
}

const LocalizeStoryMode: React.FC<ILocalizeStoryModeProps> = ({
  targetLanguage,
  isLoading,
  setTargetLanguage,
  localize,
  successMessage,
  setTranslationLevel,
  translationLevels,
  translationLevel,
  targetFolderId,
  setTargetFolderId,
  setUserTypedLanguage,
  userTypedLanguage,
  setTranslationMode,
}) => {
  const { languages, folders } = React.useContext(AppDataContext)

  React.useEffect(() => {
    if (languages.length > 0) {
      setTargetLanguage(languages[0].code)
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
            value={translationLevel}
            label="Translation level"
            onChange={(e) => {
              setTranslationLevel(e.target.value)
            }}
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
      {translationLevel === 'field' && (
        <div style={{ margin: '12px 0 20px', padding: '0 4px' }}>
          <FormControl fullWidth>
            <FormLabel>Target language</FormLabel>
            <Select
              labelId="demo-simple-select-label"
              id="demo-simple-select"
              value={targetLanguage}
              label="Age"
              onChange={(e) => {
                setTargetLanguage(e.target.value)
              }}
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
      {translationLevel === 'folder' && (
        <div style={{ margin: '12px 0 20px', padding: '0 4px' }}>
          <FormControl fullWidth>
            <FormLabel>Please select language folder</FormLabel>
            <Select
              labelId="language-folder-select-label"
              id="language-folder-select"
              value={targetFolderId}
              label="Language folder"
              onChange={(e) => {
                setTargetFolderId(e.target.value)
              }}
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
              value={userTypedLanguage}
              onChange={(e) => {
                setUserTypedLanguage(e.target.value)
              }}
            />
            <RadioGroup
              aria-labelledby="translation-mode-radio-buttons-group-label"
              defaultValue="selected"
              name="radio-buttons-group"
              onChange={(e) => {
                setTranslationMode(e.target.value)
              }}
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
        disabled={
          (!targetLanguage && translationLevel === 'field') ||
          ((!targetFolderId || !userTypedLanguage) &&
            translationLevel === 'folder') ||
          isLoading
        }
        onClick={localize}
      >
        {isLoading ? 'Localizing...' : 'Localize'}
      </Button>
      {isLoading && (
        <Typography
          variant="body2"
          textAlign="center"
        >
          Usually it takes 1min max to localize a story.
        </Typography>
      )}
      {successMessage && (
        <Typography
          variant="body1"
          fontWeight={700}
          margin="20px 0 0"
          textAlign="center"
        >
          {successMessage}
        </Typography>
      )}
    </>
  )
}

export default LocalizeStoryMode
