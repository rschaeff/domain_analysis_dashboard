// components/visualization/MolstarTest.tsx
'use client'

import React from 'react'
import { CustomMolstar } from './CustomMolstar'

export function MolstarTest() {
  return (
    <div className="border rounded-lg overflow-hidden" style={{ width: '100%', height: '400px' }}>
      <CustomMolstar
        pdbId="1cbs"
        chainId="A"
        onReady={(plugin) => console.log('Mol* is ready')}
      />
    </div>
  )
}
