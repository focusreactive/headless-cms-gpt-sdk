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
  Alert,
  List,
  ListItem,
  ListSubheader,
  Stack,
} from '@mui/material'
import { AppDataContext } from '@src/context/AppDataContext'
import React, { Dispatch, PropsWithChildren } from 'react'
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

const style = { margin: '12px 0', padding: '0 2px' }

const Form = ({
  label,
  selectOptions,
  value,
  onChange,
  children,
}: PropsWithChildren & {
  label: string
  selectOptions: JSX.Element | JSX.Element[] | null
  value: string
  onChange: (val: string) => void
}) => (
  <FormControl
    fullWidth
    sx={style}
  >
    <FormLabel>{label}</FormLabel>
    {selectOptions && (
      <Select
        labelId={`${label}-label`}
        id={label}
        value={value}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {selectOptions}
      </Select>
    )}
    {children}
  </FormControl>
)

const LocalizeStoryMode: React.FC<ILocalizeStoryModeProps> = ({
  localize,
  translationLevels,
  state,
  dispatch,
}) => {
  const { languages, folders } = React.useContext(AppDataContext)
  const [showNotTranslatableWords, setShowNotTranslatableWords] =
    React.useState(false)

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
      <Form
        label="Translation level"
        value={state.translationLevel}
        onChange={(value) =>
          dispatch({
            type: 'setTranslationLevel',
            payload: value as TranslationLevels,
          })
        }
        selectOptions={translationLevels.map((level) => (
          <MenuItem
            key={level}
            value={level}
          >
            {level}
          </MenuItem>
        ))}
      />
      {state.translationLevel === 'field' && (
        <Form
          label="Target language"
          value={state.fieldLevelTranslation.targetLanguage}
          onChange={(value) =>
            dispatch({
              type: 'setTargetLanguage',
              payload: { language: value, languages },
            })
          }
          selectOptions={languages.map((language) => (
            <MenuItem
              key={language.code}
              value={language.code}
            >
              {language.name}
            </MenuItem>
          ))}
        />
      )}
      {showNotTranslatableWords ? (
        <Stack
          direction="column"
          spacing={{ xs: 1, sm: 2 }}
          sx={style}
        >
          {state.notTranslatableWords.set.size > 0 && (
            <List
              component="nav"
              aria-labelledby="nested-list-subheader"
              subheader={
                <ListSubheader
                  component="div"
                  id="nested-list-subheader"
                >
                  Words that should not be translated. You can add{' '}
                  {state.notTranslatableWords.limit -
                    state.notTranslatableWords.set.size}{' '}
                  more words
                </ListSubheader>
              }
            >
              {Array.from(state.notTranslatableWords.set).map(
                (notTranslatableWord) => (
                  <ListItem
                    key={notTranslatableWord}
                    sx={{ fontSize: '14px' }}
                  >
                    {notTranslatableWord}
                  </ListItem>
                ),
              )}
            </List>
          )}
          <Button
            onClick={() =>
              setShowNotTranslatableWords(!showNotTranslatableWords)
            }
          >
            Hide not translatable words
          </Button>
          <FormLabel sx={style}>
            Enter a word that should be left as is
          </FormLabel>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '10px 0',
              gap: '10px',
            }}
          >
            <TextField
              size="small"
              value={state.notTranslatableWords.new}
              onChange={(e) =>
                dispatch({
                  type: 'setNewNotTranslatableWord',
                  payload: e.target.value,
                })
              }
            />
            <Button
              size="small"
              disabled={
                !state.notTranslatableWords.new ||
                state.notTranslatableWords.new?.length === 0 ||
                state.notTranslatableWords.set.size >=
                  state.notTranslatableWords.limit
              }
              onClick={() =>
                dispatch({
                  type: 'addNotTranslatableWord',
                })
              }
            >
              Add
            </Button>
          </div>
        </Stack>
      ) : (
        <Stack
          direction="column"
          spacing={{ xs: 1, sm: 2 }}
          sx={style}
        >
          <Button
            onClick={() =>
              setShowNotTranslatableWords(!showNotTranslatableWords)
            }
          >
            Show not translatable words
          </Button>
        </Stack>
      )}
      {state.translationLevel === 'folder' && (
        <Form
          label="Language Folder"
          value={String(state.folderLevelTranslation.targetFolderId)}
          onChange={(value) =>
            dispatch({ type: 'setTargetFolderId', payload: value })
          }
          selectOptions={folders.map((folder) => (
            <MenuItem
              key={folder.name}
              value={folder.id}
            >
              {folder.name}
            </MenuItem>
          ))}
        >
          <FormLabel sx={style}>Please type language</FormLabel>
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
            sx={style}
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
            {state.folderLevelTranslation.translationMode === 'all' && (
              <Alert
                severity="info"
                color="warning"
              >
                Not safe. The data on the resulting page may be corrupted. The
                current page will remain untouched. In this mode, ALL text
                fields will be translated regardless of whether they are
                "translatable".
              </Alert>
            )}
          </RadioGroup>
        </Form>
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
