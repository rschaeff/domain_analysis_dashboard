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

export function ClientMolstarViewer(props) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50">
        <LoadingSpinner />
      </div>
    )
  }

  return <MolstarViewerComponent {...props} />
}
