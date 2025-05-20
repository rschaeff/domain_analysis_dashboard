// components/visualization/MolstarTest.tsx
'use client'

import React from 'react'
import { MolstarViewer } from 'molstar-react'

export function MolstarTest() {
  return (
    <div style={{ width: '100%', height: '400px' }}>
      <MolstarViewer
        pdbId="1cbs"
        options={{
          layoutIsExpanded: false,
          viewportBackground: '#f8fafc',
        }}
      />
    </div>
  )
}
