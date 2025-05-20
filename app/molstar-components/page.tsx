'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Separator } from '@/components/ui/Separator'
import { 
  MolstarViewer, 
  MolstarCanvas, 
  MolstarProvider, 
  useMolstar,
  useStructureLoader,
  useDomainViewer,
  Domain,
  T_GROUP_COLORS
} from '@/components/visualization/molstar'

// T-Group sample colors for domain visualization
const DOMAIN_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
]

// Sample domain data for testing
const EXAMPLE_DOMAINS = [
  { id: 'domain1', start: 1, end: 100, color: '#3b82f6', label: 'Domain 1' },
  { id: 'domain2', start: 101, end: 200, color: '#ef4444', label: 'Domain 2' }
]

// Well-known PDB structures to test with
const TEST_STRUCTURES = [
  { id: '1cbs', description: 'Cellular Retinoic Acid-Binding Protein', chains: ['A'] },
  { id: '4hhb', description: 'Hemoglobin', chains: ['A', 'B', 'C', 'D'] },
  { id: '1ubq', description: 'Ubiquitin', chains: ['A'] },
  { id: '7bv2', description: 'Multi-domain protein', chains: ['A'] }
]

// Logs panel component
function LogsPanel({ logs }: { logs: {message: string, level: string, timestamp: string}[] }) {
  return (
    <div className="bg-gray-900 text-gray-100 p-3 rounded font-mono text-xs h-48 overflow-y-auto">
      {logs.length === 0 ? (
        <div className="text-gray-500">No logs yet. Load a structure to see logs.</div>
      ) : (
        logs.map((log, index) => (
          <div 
            key={index} 
            className={`mb-1 ${
              log.level === 'error' ? 'text-red-400' : 
              log.level === 'warn' ? 'text-yellow-400' : 'text-gray-100'
            }`}
          >
            [{log.timestamp}] {log.message}
          </div>
        ))
      )}
    </div>
  )
}

// Custom component to interact with Molstar hooks
function MolstarTestControls() {
  const { plugin, isBusy, isInitialized, logs, error } = useMolstar();
  const { 
    loadStructure, 
    clearStructure, 
    focusStructure, 
    focusChain, 
    isLoading, 
    hasStructure 
  } = useStructureLoader();
  
  const {
    highlightDomain,
    highlightMultipleDomains,
    clearDomainHighlights,
    restoreDefaultRepresentation,
    activeDomains,
  } = useDomainViewer();

  // Structure loading state
  const [pdbId, setPdbId] = useState('1cbs');
  const [chainId, setChainId] = useState('A');
  const [useLocalRepository, setUseLocalRepository] = useState(true);
  const [format, setFormat] = useState<'auto' | 'mmcif' | 'pdb'>('auto');
  
  // Domain highlighting state
  const [domainStart, setDomainStart] = useState(1);
  const [domainEnd, setDomainEnd] = useState(100);
  const [domainColor, setDomainColor] = useState('#3b82f6');
  const [domainLabel, setDomainLabel] = useState('Custom Domain');
  
  // Load structure
  const handleLoadStructure = async () => {
    try {
      await loadStructure({
        pdbId,
        chainId: chainId || undefined,
        format: format as any,
        useLocalRepository
      });
    } catch (err) {
      console.error('Failed to load structure:', err);
    }
  };
  
  // Highlight custom domain
  const handleHighlightDomain = async () => {
    if (domainStart > domainEnd) {
      alert('Start position must be less than or equal to end position');
      return;
    }
    
    const domain: Domain = {
      id: `custom-${Date.now()}`,
      start: domainStart,
      end: domainEnd,
      color: domainColor,
      label: domainLabel
    };
    
    await highlightDomain(domain, chainId);
  };
  
  // Highlight sample domains
  const handleHighlightSampleDomains = async () => {
    await highlightMultipleDomains(EXAMPLE_DOMAINS, chainId);
  };
  
  // Take screenshot
  const handleTakeScreenshot = () => {
    if (!plugin || !isInitialized) return;
    
    try {
      const canvas = plugin.canvas3d?.canvas.element;
      if (canvas) {
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${pdbId}_${chainId || ''}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error taking screenshot:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status */}
      <div className="bg-gray-50 p-3 rounded border">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${isInitialized ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          <span className="font-medium">Molstar {isInitialized ? 'Initialized' : 'Initializing...'}</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${hasStructure ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          <span className="font-medium">Structure {hasStructure ? 'Loaded' : 'Not Loaded'}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isLoading || isBusy ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
          <span className="font-medium">{isLoading || isBusy ? 'Processing...' : 'Ready'}</span>
        </div>
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      
      {/* Structure Controls */}
      <div className="space-y-3">
        <h3 className="font-medium">Structure Loading</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm mb-1">PDB ID</label>
            <Input
              value={pdbId}
              onChange={(e) => setPdbId(e.target.value.toLowerCase())}
              placeholder="e.g., 1cbs"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Chain ID</label>
            <Input
              value={chainId}
              onChange={(e) => setChainId(e.target.value.toUpperCase())}
              placeholder="e.g., A"
              maxLength={1}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use-local-repo"
              checked={useLocalRepository}
              onChange={() => setUseLocalRepository(!useLocalRepository)}
            />
            <label htmlFor="use-local-repo" className="text-sm">Use Local Repository</label>
          </div>
          <div className="flex items-center gap-1">
            <label className="text-sm">Format:</label>
            <select 
              value={format} 
              onChange={(e) => setFormat(e.target.value as any)}
              className="text-sm p-1 border rounded"
            >
              <option value="auto">Auto-detect</option>
              <option value="mmcif">mmCIF</option>
              <option value="pdb">PDB</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleLoadStructure} disabled={!isInitialized || isLoading}>
            Load Structure
          </Button>
          <Button size="sm" variant="outline" onClick={clearStructure} disabled={!hasStructure}>
            Clear Structure
          </Button>
          <Button size="sm" variant="outline" onClick={focusStructure} disabled={!hasStructure}>
            Reset View
          </Button>
          <Button size="sm" variant="outline" onClick={handleTakeScreenshot} disabled={!hasStructure}>
            Screenshot
          </Button>
        </div>
      </div>

      <Separator />
      
      {/* Domain Controls */}
      <div className="space-y-3">
        <h3 className="font-medium">Domain Visualization</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm mb-1">Start Position</label>
            <Input
              type="number"
              value={domainStart}
              onChange={(e) => setDomainStart(parseInt(e.target.value) || 1)}
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">End Position</label>
            <Input
              type="number"
              value={domainEnd}
              onChange={(e) => setDomainEnd(parseInt(e.target.value) || 1)}
              min="1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm mb-1">Label</label>
            <Input
              value={domainLabel}
              onChange={(e) => setDomainLabel(e.target.value)}
              placeholder="Domain name"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={domainColor}
                onChange={(e) => setDomainColor(e.target.value)}
                className="h-9 w-9"
              />
              <Input
                value={domainColor}
                onChange={(e) => setDomainColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={handleHighlightDomain} disabled={!hasStructure}>
            Highlight Domain
          </Button>
          <Button size="sm" variant="outline" onClick={handleHighlightSampleDomains} disabled={!hasStructure}>
            Sample Domains
          </Button>
          <Button size="sm" variant="outline" onClick={clearDomainHighlights} disabled={!hasStructure}>
            Clear Domains
          </Button>
          <Button size="sm" variant="outline" onClick={restoreDefaultRepresentation} disabled={!hasStructure}>
            Reset View
          </Button>
        </div>
      </div>
      
      {/* Active Domains List */}
      {activeDomains.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium">Active Domains ({activeDomains.length})</h3>
          <div className="space-y-1">
            {activeDomains.map((domain) => (
              <div key={domain.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: domain.color }}></div>
                <div className="text-sm">{domain.label || domain.id}</div>
                <div className="text-xs text-gray-500 ml-auto">
                  {domain.start}-{domain.end}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Logs */}
      <Separator />
      <div className="space-y-2">
        <h3 className="font-medium">Logs</h3>
        <LogsPanel logs={logs} />
      </div>
    </div>
  );
}

// Quick structure picker component
function QuickStructurePicker({ onSelect }: { onSelect: (pdbId: string, chainId: string) => void }) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Test Structures</h3>
      <div className="grid grid-cols-2 gap-2">
        {TEST_STRUCTURES.map((structure) => (
          <Card key={structure.id} className="p-3 hover:bg-gray-50 cursor-pointer" onClick={() => onSelect(structure.id, structure.chains[0])}>
            <div className="font-medium">{structure.id.toUpperCase()}</div>
            <div className="text-xs text-gray-500">{structure.description}</div>
            <div className="text-xs mt-1">
              Chains: {structure.chains.join(', ')}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Main page component
export default function MolstarComponentsPage() {
  const [activeTab, setActiveTab] = useState('basic');
  const [selectedPdb, setSelectedPdb] = useState('');
  const [selectedChain, setSelectedChain] = useState('');
  
  // Handle structure selection from picker
  const handleStructureSelect = (pdbId: string, chainId: string) => {
    setSelectedPdb(pdbId);
    setSelectedChain(chainId);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Molstar Components Test Page</h1>
      
      <Alert>
        <AlertDescription>
          This page demonstrates the capabilities of the molstar components using the context-hooks pattern.
          You can test both the simplified components and the advanced hooks API.
        </AlertDescription>
      </Alert>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="basic">Basic Viewer</TabsTrigger>
                <TabsTrigger value="advanced">Advanced API</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="h-[600px] rounded-lg overflow-hidden border">
              {activeTab === 'basic' ? (
                // Basic viewer with props-based API
                <MolstarViewer
                  pdbId={selectedPdb || '1cbs'}
                  chainId={selectedChain || 'A'}
                  domains={EXAMPLE_DOMAINS}
                  width="100%"
                  height="100%"
                  showControls={true}
                  colorByClassification={true}
                />
              ) : (
                // Advanced implementation with context and hooks
                <MolstarProvider>
                  <div className="grid grid-cols-1 md:grid-cols-3 h-full">
                    <div className="md:col-span-2 border-r">
                      <MolstarCanvas width="100%" height="100%" showControls={true} />
                    </div>
                    <div className="p-4 overflow-y-auto">
                      <MolstarTestControls />
                    </div>
                  </div>
                </MolstarProvider>
              )}
            </div>
          </Card>
        </div>
        
        <div>
          <Card className="p-6">
            <QuickStructurePicker onSelect={handleStructureSelect} />
            
            <Separator className="my-6" />
            
            <div className="space-y-4">
              <h3 className="font-medium">Component Documentation</h3>
              
              <div className="space-y-2">
                <div className="font-medium text-sm">Basic Component</div>
                <div className="text-sm text-gray-700">
                  The <code>MolstarViewer</code> component provides a simple props-based API for quickly displaying
                  molecular structures with domain highlighting capabilities.
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium text-sm">Advanced API</div>
                <div className="text-sm text-gray-700">
                  For more complex applications, use the context-hooks pattern:
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><code>MolstarProvider</code> - Context provider</li>
                    <li><code>MolstarCanvas</code> - Rendering component</li>
                    <li><code>useMolstar</code> - Core state and plugin access</li>
                    <li><code>useStructureLoader</code> - Structure loading</li>
                    <li><code>useDomainViewer</code> - Domain visualization</li>
                  </ul>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium text-sm">Component Migration</div>
                <div className="text-sm text-gray-700">
                  Legacy components (<code>CanvasMolstarViewer</code>, etc.) should be migrated
                  to use these standardized components.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      {/* Deprecation Notice */}
      <Card className="p-6 bg-amber-50 border-amber-200">
        <h2 className="text-xl font-semibold mb-4">Deprecation Notice</h2>
        <p className="mb-4">
          The following test pages are using deprecated Molstar components and should be updated to use the new architecture:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li><code>/app/domain-viewer/page.tsx</code> - Uses <code>CanvasMolstarViewer</code></li>
          <li><code>/app/domain-visualization/page.tsx</code> - Uses <code>DomainStructureViewer</code></li>
          <li><code>/app/molstar-debug/page.tsx</code> - Uses <code>ImprovedMolstarViewer</code></li>
          <li><code>/app/molstar-safe/page.tsx</code> - Uses <code>SafeModeViewer</code></li>
          <li><code>/app/molstar-test/page.tsx</code> - Uses direct plugin manipulation</li>
        </ul>
        <p className="mt-4">
          Please use this test page as a reference for the new architecture. The deprecated components will be removed in a future update.
        </p>
      </Card>
    </div>
  );
}
