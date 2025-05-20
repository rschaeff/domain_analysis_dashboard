'use client'

import React from 'react'
import MinimalMolstarDebug from '@/components/MinimalMolstarDebug'
import { Card } from '@/components/ui/Card'

export default function MolstarDebugPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Molstar Canvas Debugging</h1>
      
      <Card className="p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Canvas Rendering Test</h2>
        <p className="mb-4 text-gray-700">
          This page includes a minimal Molstar implementation with explicit debug logging to troubleshoot the blank canvas issue.
          The component will log each step of the initialization process and apply visible borders to help diagnose rendering problems.
        </p>
        
        <div className="flex flex-col items-center">
          <MinimalMolstarDebug />
        </div>
      </Card>
      
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Troubleshooting Tips</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Check if the red border appears around the canvas - this confirms the canvas element is rendering</li>
          <li>Verify the CSS loading status - without Molstar CSS, the viewer may not render correctly</li>
          <li>Watch the log display to see which specific initialization step might be failing</li>
          <li>Check browser console for additional errors that might not be captured in the component</li>
          <li>If the blue background appears but no structure, the WebGL context is working but structure loading failed</li>
          <li>Test in different browsers to identify if the issue is browser-specific</li>
        </ul>
      </Card>
    </div>
  )
}
