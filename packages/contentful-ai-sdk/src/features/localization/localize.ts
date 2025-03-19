import localizeFields from './mode/fields';
import localizeEntry from './mode/entry';

type LocalizeFieldsProps = {
  translationLevel: 'field';
  targetLanguage: string;
  entryId: string;
};

type LocalizeEntryProps = {
  translationLevel: 'entry';
  targetLanguage: string;
  localEntryId: string;
  globalEntryId: string;
};

type LocalizeProps = LocalizeFieldsProps | LocalizeEntryProps;

const localize = async (props: LocalizeProps) => {
  return props.translationLevel === 'field' ? localizeFields(props) : localizeEntry(props);
};

export default localize;
