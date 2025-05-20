// components/visualization/MolstarTest.tsx
'use client'

import React from 'react'
import { Molstar } from 'molstar-react'

export function MolstarTest() {
  return (
    <div style={{ width: '100%', height: '400px' }}>
      <Molstar
        pdbId="1cbs"
        options={{
          layoutIsExpanded: false,
          viewportBackground: '#f8fafc',
        }}
      />
    </div>
  )
}
