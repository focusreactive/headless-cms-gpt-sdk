import SumariseDocument from '../components/Summary'
import FindTags from '../components/Tags'
import TranslateDocumentFeature from '../components/TranslateDocumentFeature'

export enum FeatureName {
  Translate = 'Translate',
  Tags = 'Tags',
  Summary = 'Summary',
}

interface BaseFeatureConfig {
  name: FeatureName
  title: string
}

interface TranslateFeatureConfig extends BaseFeatureConfig {
  component: typeof TranslateDocumentFeature
}

export const FeaturesConfig: TranslateFeatureConfig[] = [
  {
    name: FeatureName.Translate,
    title: 'Translate',
    component: TranslateDocumentFeature,
  },
  {
    name: FeatureName.Tags,
    title: 'Tags',
    component: FindTags,
  },
  {
    name: FeatureName.Summary,
    title: 'Summary',
    component: SumariseDocument,
  },
]
