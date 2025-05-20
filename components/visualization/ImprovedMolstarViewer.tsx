'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'

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
  const [loadRequested, setLoadRequested] = useState(false);

  // Use this flag to prevent infinite fetch attempts
  const isLoadingRef = useRef(false);

  // Add a log entry for debugging
  const addLog = useCallback((message: string) => {
    console.log(`[MolstarViewer] ${message}`);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  }, []);

  // Report error safely
  const reportError = useCallback((errorMessage: string) => {
    addLog(`Error: ${errorMessage}`);
    setError(errorMessage);
    setIsLoading(false);
    isLoadingRef.current = false;
    if (onError) onError(errorMessage);
  }, [addLog, onError]);

  // Add required CSS - only run once on mount
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
  }, [addLog]);

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
        // Signal that we're ready to load a structure
        setLoadRequested(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        reportError(`Error initializing plugin: ${errorMessage}`);
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
  }, [addLog, reportError]);

  // Load structure in a separate effect when initialized and PDB ID changes
  // Use loadRequested as a trigger to prevent repeated loading after errors
  useEffect(() => {
    if (!isInitialized || !pluginRef.current || !pdbId || !loadRequested || isLoadingRef.current) return;

    const loadStructure = async () => {
      // Set loading flag to prevent multiple concurrent requests
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        addLog(`Loading structure for ${pdbId}${chainId ? ` chain ${chainId}` : ''}`);

        const plugin = pluginRef.current;
        let success = false;

        // Try to load the structure using our API route
        try {
          addLog(`Loading structure for PDB ID: ${pdbId}`);

          // Use the local API route which handles repository access
          const url = `/api/pdb/${pdbId.toLowerCase()}`;
          addLog(`Fetching from API: ${url}`);

          // First make a HEAD request to check format
          const headResponse = await fetch(url, { method: 'HEAD' });
          if (!headResponse.ok) {
            throw new Error(`HEAD request failed: ${headResponse.status} ${headResponse.statusText}`);
          }

          // Get format from header if available
          const format = headResponse.headers.get('X-PDB-Format');
          addLog(`Detected format from API: ${format || 'unknown'}`);

          // Now fetch the actual file
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch structure: ${response.status} ${response.statusText}`);
          }

          const buffer = await response.arrayBuffer();
          if (buffer.byteLength < 100) {
            throw new Error(`Data is too small (${buffer.byteLength} bytes)`);
          }

          addLog(`Downloaded data: ${buffer.byteLength} bytes`);

          // Use the detected format
          const plugin = pluginRef.current;
          const data = await plugin.builders.data.rawData({ data: new Uint8Array(buffer) });

          // Determine format to use for parsing
          let formatName;
          if (format === 'mmcif') {
            formatName = 'mmcif';
          } else if (format === 'pdb') {
            formatName = 'pdb';
          } else {
            // Try to detect from content if header wasn't helpful
            // For simplicity we'll try mmCIF first, then PDB
            formatName = 'mmcif';
          }

          addLog(`Parsing trajectory as ${formatName}`);
          try {
            const trajectory = await plugin.builders.structure.parseTrajectory(data, formatName);
            addLog(`${formatName.toUpperCase()} trajectory parsed successfully`);

            // Apply representation
            await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
              id: 'preset-structure-representation-cartoon',
              params: {}
            });

            // Handle chain selection
            if (chainId) {
              try {
                // Simplified chain selection
                plugin.managers.structure.selection.fromSelectionString(`chain ${chainId}`);
                plugin.managers.camera.focusSelection();
              } catch (chainErr) {
                addLog(`Warning: Could not focus on chain ${chainId}`);
                plugin.canvas3d?.resetCamera();
              }
            } else {
              plugin.canvas3d?.resetCamera();
            }

            addLog("Structure loaded successfully");
            setIsLoading(false);
            isLoadingRef.current = false;
            if (onReady) onReady(plugin);
          } catch (parseError) {
            addLog(`Error parsing as ${formatName}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);

            // If mmCIF parsing failed, try PDB format
            if (formatName === 'mmcif') {
              addLog('Falling back to PDB format');
              try {
                const trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb');
                addLog('PDB trajectory parsed successfully');

                await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
                  id: 'preset-structure-representation-cartoon',
                  params: {}
                });

                plugin.canvas3d?.resetCamera();
                addLog("Structure loaded successfully with PDB fallback");
                setIsLoading(false);
                isLoadingRef.current = false;
                if (onReady) onReady(plugin);
              } catch (pdbError) {
                throw new Error(`Failed with both mmCIF and PDB formats: ${pdbError instanceof Error ? pdbError.message : String(pdbError)}`);
              }
            } else {
              throw parseError;
            }
          }
        } catch (err) {

        setIsLoading(false);
        isLoadingRef.current = false;
        if (success && onReady) onReady(plugin);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        reportError(errorMessage);
        // Important: set loadRequested to false to prevent automatic retries
        setLoadRequested(false);
      }
    };

    loadStructure();
  }, [pdbId, chainId, isInitialized, loadRequested, addLog, reportError, onReady]);

  // Function to manually trigger loading (used by Load Structure button)
  const triggerLoad = useCallback(() => {
    if (!isInitialized) return;
    setLoadRequested(true);
  }, [isInitialized]);

  // No need for imperative handle, parent controls loading via props

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
    </div>
  );
}
