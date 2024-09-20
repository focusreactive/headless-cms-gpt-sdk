import { SidebarAppSDK } from '@contentful/app-sdk'
import { useAutoResizer, useSDK } from '@contentful/react-apps-toolkit'
import { initSDK } from '@focus-reactive/contentful-ai-sdk'
import ContentLayout from '../actions/toolkit/components/ContentLayout'
import { useEffect } from 'react'

// const INSTALLATION_PARAMETER_ID = 'openAiToken'

const Sidebar = () => {
  const sdk = useSDK<SidebarAppSDK>()

  useAutoResizer()

  // const getInstallationOpenAiToken = () => {
  //   return sdk.cma.appDefinition
  //   .get({ appDefinitionId: sdk.ids.app! })
  //   .then((data) => {
  //     const openAiToken = data.parameters?.installation?.find(param => param.id === INSTALLATION_PARAMETER_ID)
  //     return openAiToken?.default
  //   })
  // }

  useEffect(() => {
    initSDK({ client: sdk.cma, openAiKey: process.env.REACT_APP_OPENAI_TOKEN! })
  }, [])

  return <ContentLayout />
}

export default Sidebar
