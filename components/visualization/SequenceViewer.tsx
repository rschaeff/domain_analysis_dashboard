
'use client'

import React from 'react'
import { NIGHTINGALE_CONFIG } from '@/lib/config'
import { NightingaleViewerProps } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Search, Download, Settings } from 'lucide-react'

export function SequenceViewer({
  protein_id,
  sequence,
  domains = [],
  features = []
}: NightingaleViewerProps) {
  // This is a placeholder component for EBI Nightingale integration
  // In a real implementation, this would embed the Nightingale components

  const handleLoadAnnotations = () => {
    // Placeholder for loading protein annotations from EBI
    console.log(`Loading annotations for: ${protein_id}`)
  }

  const handleExportSequence = () => {
    // Placeholder for sequence export functionality
    console.log('Exporting sequence and annotations')
  }

  // Mock sequence for demonstration (would come from props)
  const displaySequence = sequence || 'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFDEHVKLVNELTEFAKTCVADESHAGCEKSLHTLFGDELCKVASLRETYGDMADCCEKQEPERNECFLSHKDDSPDLPKLKPDPNTLCDEFKADEKKFWGKYLYEIARRHPYFYAPELLYYANKYNGVFQECCQAEDKGACLLPKIETMREKVLASSARQRLRCASIQKFGERALKAWSVARLSQKFPKAEFVEVTKLVTDLTKVHKECCHGDLLECADDRADLAKYICDNQDTISSKLKECCDKPLLEKSHCIAEVEKDAIPENLPPLTADFAEDKDVCKNYQEAKDAFLGSFLYEYSRRHPEYAVSVLLRLAKEYEATLEECCAKDDPHACYSTVFDKLKHLVDEPQNLIKQNCDQFEKLGEYGFQNALIVRYTRKVPQVSTPTLVEVSRSLGKVGTRCCTKPESERMPCTEDYLSLILNRLCVLHEKTPVSEKVTKCCTESLVNRRPCFSALTPDETYVPKAFDEKLFTFHADICTLPDTEKQIKKQTALVELLKHKPKATEEQLKTVMENFVAFVDKCCAADDKEACFAVEGPKLVVSTQTALA'

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Sequence Annotations - {protein_id}
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleLoadAnnotations}>
              <Search className="w-4 h-4 mr-1" />
              Load EBI Data
            </Button>
            <Button size="sm" variant="outline">
              <Settings className="w-4 h-4 mr-1" />
              Configure
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportSequence}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Placeholder for Nightingale sequence viewer */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Track headers */}
          <div className="bg-gray-50 border-b p-3">
            <div className="text-sm font-medium">Sequence Length: {displaySequence.length} residues</div>
          </div>

          {/* Sequence track */}
          <div className="p-4 space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Amino Acid Sequence</div>
              <div className="font-mono text-xs bg-gray-50 p-3 rounded border overflow-x-auto">
                {displaySequence.match(/.{1,60}/g)?.map((line, i) => (
                  <div key={i} className="flex">
                    <span className="text-gray-500 w-12 text-right mr-4">
                      {i * 60 + 1}
                    </span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Domain track */}
            {domains.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Domain Boundaries</div>
                <div className="relative h-8 bg-gray-100 rounded border">
                  {domains.map((domain, index) => (
                    <div
                      key={index}
                      className="absolute h-full border-2 rounded opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                      style={{
                        left: `${(domain.start / displaySequence.length) * 100}%`,
                        width: `${((domain.end - domain.start + 1) / displaySequence.length) * 100}%`,
                        backgroundColor: domain.color,
                        borderColor: domain.color
                      }}
                      title={`${domain.label} (${domain.start}-${domain.end})`}
                    >
                      <div className="h-full flex items-center justify-center text-xs font-medium text-white">
                        {domain.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feature tracks */}
            {features.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-2">Sequence Features</div>
                <div className="space-y-2">
                  {Object.entries(
                    features.reduce((acc, feature) => {
                      if (!acc[feature.type]) acc[feature.type] = []
                      acc[feature.type].push(feature)
                      return acc
                    }, {} as Record<string, typeof features>)
                  ).map(([type, typeFeatures]) => (
                    <div key={type}>
                      <div className="text-xs text-gray-600 mb-1 capitalize">{type}</div>
                      <div className="relative h-6 bg-gray-100 rounded border">
                        {typeFeatures.map((feature, index) => (
                          <div
                            key={index}
                            className="absolute h-full bg-blue-500 opacity-60 hover:opacity-80 transition-opacity cursor-pointer rounded"
                            style={{
                              left: `${(feature.start / displaySequence.length) * 100}%`,
                              width: `${((feature.end - feature.start + 1) / displaySequence.length) * 100}%`
                            }}
                            title={`${feature.description} (${feature.start}-${feature.end})`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Integration guide */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-900 mb-2">
            EBI Nightingale Integration Guide
          </h4>
          <div className="text-sm text-green-800 space-y-1">
            <p>• Sequence visualization with interactive tracks</p>
            <p>• Domain boundaries highlighted with colors and labels</p>
            <p>• Integration with UniProt, Pfam, and other EBI resources</p>
            <p>• Secondary structure predictions and experimental data</p>
            <p>• Clickable features for detailed information</p>
            <p>• Export capabilities for figures and data</p>
          </div>
        </div>

        {/* Track configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Available Tracks</h4>
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked />
                <span>Sequence</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked />
                <span>Domain Boundaries</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" />
                <span>Secondary Structure</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" />
                <span>Topology Features</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" />
                <span>Conservation</span>
              </label>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Data Sources</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>UniProt - Available</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span>Pfam - Available</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                <span>DSSP - Loading...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                <span>InterPro - Not loaded</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
