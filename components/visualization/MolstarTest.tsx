// components/visualization/MolstarTest.tsx
'use client'

import React from 'react'
import { CanvasMolstarViewer } from './CanvasMolstarViewer'

export function MolstarTest() {
  return (
    <div className="p-6 border rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Mol* Test</h2>
      <div className="border rounded-lg overflow-hidden" style={{ height: '400px' }}>
        <CanvasMolstarViewer
          pdbId="1cbs"
          chainId="A"
          onReady={(plugin) => console.log('Mol* is ready', plugin)}
        />
      </div>
    </div>
  )
}
