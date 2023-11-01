import TranslateDocumentFeature from '../components/TranslateDocumentFeature'

export enum FeatureName {
  Translate = 'Translate',
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
]
