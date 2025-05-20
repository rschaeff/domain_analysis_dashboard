'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import MinimalMolstarDebug from '@/components/visualization/MinimalMolstarDebug'
import FixedMolstarDebug from '@/components/visualization/FixedMolstarDebug'

export default function MolstarDebugPage() {
  const [activeTab, setActiveTab] = useState('fixed')

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Molstar Canvas Debugging</h1>

      <Card className="p-6 mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="standard">Standard Approach</TabsTrigger>
            <TabsTrigger value="fixed">Fixed Approach</TabsTrigger>
          </TabsList>

          <TabsContent value="standard">
            <h2 className="text-xl font-semibold mb-4">Canvas Rendering Test (Standard)</h2>
            <p className="mb-4 text-gray-700">
              This implementation tries to load external CSS from various sources before initializing Molstar.
              It attempts to load a PDB file directly, which may cause parsing issues.
            </p>

            <div className="flex flex-col items-center">
              <MinimalMolstarDebug />
            </div>
          </TabsContent>

          <TabsContent value="fixed">
            <h2 className="text-xl font-semibold mb-4">Canvas Rendering Test (Fixed)</h2>
            <p className="mb-4 text-gray-700">
              This implementation adds inline CSS as a backup and tries both mmCIF and PDB formats for structure loading.
              It also uses more explicit representation settings.
            </p>

            <div className="flex flex-col items-center">
              <FixedMolstarDebug />
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Troubleshooting Tips</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Check if the red border appears around the canvas - this confirms the canvas element is rendering</li>
          <li>Verify the CSS loading status - without Molstar CSS, the viewer may not render correctly</li>
          <li>The fixed approach tries both mmCIF and PDB formats for loading the structure</li>
          <li>Watch the log display to see which specific initialization step might be failing</li>
          <li>Check browser console for additional errors that might not be captured in the component</li>
          <li>If the blue background appears but no structure, the WebGL context is working but structure loading failed</li>
        </ul>
      </Card>
    </div>
  )
}
