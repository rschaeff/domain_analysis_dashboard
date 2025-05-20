'use client'

import React, { useEffect, useRef, useState } from 'react'

interface MolstarViewerProps {
  pdbId: string;
  chainId?: string;
  height?: string | number;
  width?: string | number;
  onReady?: (plugin: any) => void;
  onError?: (error: string) => void;
}

export function ImprovedMolstarViewer({
  pdbId,
  chainId,
  height = '400px',
  width = '100%',
  onReady,
  onError
}: MolstarViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Add a log entry for debugging
  const addLog = (message: string) => {
    console.log(`[MolstarViewer] ${message}`);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  };

  // Add required CSS
  useEffect(() => {
    const cssId = 'molstar-inline-css';
    if (!document.getElementById(cssId)) {
      const style = document.createElement('style');
      style.id = cssId;
      style.textContent = `
        .msp-plugin {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .msp-canvas3d {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }
        .msp-viewport-controls {
          position: absolute;
          right: 10px;
          top: 10px;
        }
        .msp-layout-expanded, .msp-layout-standard {
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
        }
      `;
      document.head.appendChild(style);
      addLog("Added inline CSS");
    }

    // Also try to load the external CSS for completeness
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/molstar.css';
    document.head.appendChild(link);
  }, []);

  // Initialize the plugin only once
  useEffect(() => {
    if (isInitialized || !canvasRef.current || !containerRef.current) return;

    const initMolstar = async () => {
      try {
        addLog("Initializing Molstar plugin");
        setIsLoading(true);
        setError(null);
        
        // Import Molstar libraries
        const { DefaultPluginSpec } = await import('molstar/lib/mol-plugin/spec');
        const { PluginContext } = await import('molstar/lib/mol-plugin/context');
        
        addLog("Creating plugin instance");
        // Create plugin instance
        const plugin = new PluginContext(DefaultPluginSpec());
        await plugin.init();
        
        // Store reference
        pluginRef.current = plugin;
        
        addLog("Initializing viewer");
        // Initialize viewer
        const viewerInitialized = plugin.initViewer(canvasRef.current, containerRef.current);
        
        if (!viewerInitialized) {
          throw new Error('Failed to initialize Molstar viewer');
        }
        
        // Set background color to confirm rendering is working
        plugin.canvas3d?.setProps({
          backgroundColor: { color: 0xFFFFFF }
        });
        
        addLog("Viewer initialized successfully");
        setIsInitialized(true);
        
        // Don't load structure yet - we'll do that in a separate effect
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        addLog(`Error initializing plugin: ${errorMessage}`);
        setError(errorMessage);
        setIsLoading(false);
        if (onError) onError(errorMessage);
      }
    };
    
    initMolstar();
    
    // Cleanup
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
        } catch (e) {
          console.error('Error disposing plugin:', e);
        }
        pluginRef.current = null;
        setIsInitialized(false);
      }
    };
  }, [onError]); // Only initialize once

  // Load structure in a separate effect to avoid race conditions
  useEffect(() => {
    if (!isInitialized || !pluginRef.current || !pdbId) return;
    
    const loadStructure = async () => {
      try {
        addLog(`Loading structure for ${pdbId}${chainId ? ` chain ${chainId}` : ''}`);
        setIsLoading(true);
        setError(null);
        
        const plugin = pluginRef.current;
        
        // Function to validate downloaded data
        const validateData = (data: any) => {
          if (!data) throw new Error('Downloaded data is null or undefined');
          
          // Inspect the data to make sure it's valid
          if (data.data && data.data.byteLength < 100) {
            throw new Error(`Downloaded data is too small (${data.data.byteLength} bytes)`);
          }
          
          addLog(`Downloaded data successfully (${data.data?.byteLength || 'unknown'} bytes)`);
          return data;
        };
        
        // Important fix from GitHub issue - ensure structured & sequential loading
        // with stronger error handling per format
        
        let success = false;
        
        // Try mmCIF format first with validation
        try {
          addLog("Attempting mmCIF format");
          const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
          
          // Create a specific data loader rather than using the built-in one
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch mmCIF: ${response.status} ${response.statusText}`);
          }
          
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength < 100) {
            throw new Error(`mmCIF data is too small (${buffer.byteLength} bytes)`);
          }
          
          addLog(`Downloaded mmCIF data: ${buffer.byteLength} bytes`);
          
          // Use the data loader with the validated buffer
          const data = await plugin.builders.data.rawData({ data: new Uint8Array(buffer) });
          
          addLog("Parsing mmCIF data");
          // Use a try block specifically for parsing to catch format errors
          const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
          addLog("mmCIF trajectory parsed successfully");
          
          // Apply representation only after successful parsing
          await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
            id: 'preset-structure-representation-cartoon',
            params: {}
          });
          
          // Handle chain selection
          if (chainId) {
            try {
              // This part is tricky and depends on the plugin's API
              // We'll try a simplified approach
              plugin.managers.structure.selection.fromSelectionString(`chain ${chainId}`);
              plugin.managers.camera.focusSelection();
            } catch (chainErr) {
              addLog(`Warning: Could not focus on chain ${chainId}: ${chainErr}`);
              plugin.canvas3d?.resetCamera();
            }
          } else {
            plugin.canvas3d?.resetCamera();
          }
          
          success = true;
          addLog("mmCIF structure loaded successfully");
        } catch (mmcifErr) {
          addLog(`mmCIF format failed: ${mmcifErr instanceof Error ? mmcifErr.message : String(mmcifErr)}`);
          
          // Fall back to PDB format with validation
          try {
            addLog("Falling back to PDB format");
            const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.pdb`;
            
            // Create a specific data loader rather than using the built-in one
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`Failed to fetch PDB: ${response.status} ${response.statusText}`);
            }
            
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength < 100) {
              throw new Error(`PDB data is too small (${buffer.byteLength} bytes)`);
            }
            
            addLog(`Downloaded PDB data: ${buffer.byteLength} bytes`);
            
            // Use the data loader with the validated buffer
            const data = await plugin.builders.data.rawData({ data: new Uint8Array(buffer) });
            
            addLog("Parsing PDB data");
            // Use a try block specifically for parsing to catch format errors
            const trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb');
            addLog("PDB trajectory parsed successfully");
            
            // Apply representation only after successful parsing
            await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
              id: 'preset-structure-representation-cartoon',
              params: {}
            });
            
            plugin.canvas3d?.resetCamera();
            success = true;
            addLog("PDB structure loaded successfully");
          } catch (pdbErr) {
            addLog(`PDB format failed: ${pdbErr instanceof Error ? pdbErr.message : String(pdbErr)}`);
            throw new Error(`Failed with both mmCIF and PDB formats. PDB error: ${pdbErr instanceof Error ? pdbErr.message : String(pdbErr)}`);
          }
        }
        
        setIsLoading(false);
        if (success && onReady) onReady(plugin);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        addLog(`Error loading structure: ${errorMessage}`);
        setError(errorMessage);
        setIsLoading(false);
        if (onError) onError(errorMessage);
      }
    };
    
    loadStructure();
  }, [pdbId, chainId, isInitialized, onReady, onError]);

  return (
    <div className="relative" style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Loading structure...</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-red-500 bg-white p-4 rounded shadow max-w-md">
            <p className="font-bold mb-2">Error:</p>
            <p className="mb-2">{error}</p>
            <details className="text-xs text-gray-600 mt-2">
              <summary className="cursor-pointer">View logs</summary>
              <div className="mt-2 p-2 bg-gray-100 max-h-40 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </details>
          </div>
        </div>
      )}
      
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ position: 'relative' }}
      >
        <canvas 
          ref={canvasRef}
          style={{ 
            width: '100%', 
            height: '100%', 
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
      </div>
      
      {/* Debug panel - can be removed in production */}
      {process.env.NODE_ENV === 'development' && (
        <details className="text-xs text-gray-600 mt-2 border-t pt-2">
          <summary className="cursor-pointer">Debug logs</summary>
          <div className="mt-2 p-2 bg-gray-100 max-h-40 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
