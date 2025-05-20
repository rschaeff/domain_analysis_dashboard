// components/visualization/ClientMolstarViewer.tsx
'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

// Dynamically import the Mol* viewer component with no SSR
const MolstarViewerComponent = dynamic(
  () => import('./CanvasMolstarViewer').then(mod => ({ default: mod.CanvasMolstarViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
        <p className="ml-3 text-gray-600">Loading Mol* viewer...</p>
      </div>
    )
  }
)

// Create a modified version of the CanvasMolstarViewer that implements fallback from local to remote
export function ClientMolstarViewer(props) {
  const [isMounted, setIsMounted] = useState(false)
  const [localFailed, setLocalFailed] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Reset local failed state when props change
  useEffect(() => {
    setLocalFailed(false)
  }, [props.pdbId, props.chainId])

  const handleFallbackError = (error) => {
    console.warn('Local repository failed, falling back to remote:', error)
    setLocalFailed(true)

    // Call the original onError if provided
    if (props.onError) {
      props.onError(`${error} (Trying external repository...)`)
    }
  }

  if (!isMounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  // If using local repository and it failed, try the remote repository
  if (props.useLocalRepository && localFailed) {
    const remoteProps = {
      ...props,
      useLocalRepository: false,
      onError: props.onError
    }
    return <MolstarViewerComponent {...remoteProps} />
  }

  // Use the original props, but with our modified error handler that enables fallback
  const modifiedProps = {
    ...props,
    onError: props.useLocalRepository ? handleFallbackError : props.onError
  }

  return <MolstarViewerComponent {...modifiedProps} />
}
