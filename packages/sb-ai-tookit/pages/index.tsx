import { GetServerSideProps, NextPage } from 'next'
import { authHandlerParams, endpointPrefix } from '@src/auth'
import React, { useEffect, useState } from 'react'
import {
  AppSession,
  isAppSessionQuery,
  sessionCookieStore,
} from '@storyblok/app-extension-auth'

import { lightTheme } from '@storyblok/mui'
import { CssBaseline, ThemeProvider } from '@mui/material'
import FeaturesLayout from '@src/components/FeaturesLayout'
import { initSDK } from 'sb-ai-sdk'

type PageProps = {
  spaceId: number
  userId: number
  appSession: AppSession
}

const Home: NextPage<PageProps> = (props) => {
  const [currentHeight, setCurrentHeight] = useState<number>(0)

  useEffect(() => {
    const handleResize = () => {
      const height = document.body.clientHeight

      if (height === currentHeight) {
        return
      }

      window.parent.postMessage(
        {
          action: 'tool-changed',
          tool: 'focusreactive-ai-toolkit',
          event: 'heightChange',
          height: height,
          width: '100%',
        },
        '*',
      )

      setCurrentHeight(height)
    }

    const observer = new ResizeObserver(handleResize)
    observer.observe(document.body)

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    console.log('props.appSession', props.appSession)

    initSDK({
      managementToken: props.appSession.accessToken,
      pluginName: 'focusreactive-ai-toolkit',
      openAiToken: process.env.NEXT_PUBLIC_SANITY_STUDIO_OPENAI_TOKEN,
      spaceId: String(props.spaceId),
    })
  }, [])

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <FeaturesLayout />
    </ThemeProvider>
  )
}
export default Home

export const initAuthFlow = {
  redirect: {
    permanent: false,
    destination: `${endpointPrefix}/storyblok`,
  },
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (
  context,
) => {
  const { query } = context

  if (!isAppSessionQuery(query)) {
    return initAuthFlow
  }

  const sessionStore = sessionCookieStore(authHandlerParams)(context)
  const appSession = await sessionStore.get(query)

  if (!appSession) {
    return initAuthFlow
  }

  return {
    props: {
      appSession,
      spaceId: appSession.spaceId,
      userId: appSession.userId,
    },
  }
}
