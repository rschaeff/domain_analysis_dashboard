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
  const isLoadingRef = useRef(false);
  const isInitializedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Add a log entry for debugging
  const addLog = useCallback((message: string) => {
    console.log(`[MolstarViewer] ${message}`);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  }, []);

  // Report errors consistently
  const reportError = useCallback((errorMessage: string) => {
    console.error(`[MolstarViewer Error] ${errorMessage}`);
    setError(errorMessage);
    setIsLoading(false);
    isLoadingRef.current = false;
    if (onError) onError(errorMessage);
  }, [onError]);

  // Initialize CSS once
  useEffect(() => {
    // Add inline CSS for Molstar
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
    }

    // Also try to load the external CSS for completeness
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/molstar.css';
    document.head.appendChild(link);
  }, []);

  // Step 1: Initialize the Molstar plugin - only once
  useEffect(() => {
    // Skip if already initialized or refs aren't ready
    if (isInitializedRef.current || !canvasRef.current || !containerRef.current) {
      return;
    }

    // Prevent concurrent initialization
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    const initPlugin = async () => {
      try {
        // Import Molstar libraries
        const { DefaultPluginSpec } = await import('molstar/lib/mol-plugin/spec');
        const { PluginContext } = await import('molstar/lib/mol-plugin/context');

        // Create plugin instance
        const plugin = new PluginContext(DefaultPluginSpec());
        await plugin.init();

        // Store reference
        pluginRef.current = plugin;

        // Initialize viewer
        const viewerInitialized = plugin.initViewer(canvasRef.current, containerRef.current);

        if (!viewerInitialized) {
          throw new Error('Failed to initialize Molstar viewer');
        }

        // Set background color
        plugin.canvas3d?.setProps({
          backgroundColor: { color: 0xFFFFFF }
        });

        // Mark as initialized
        isInitializedRef.current = true;

        // Load structure now that plugin is initialized
        loadStructure();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        reportError(`Initialization error: ${errorMessage}`);
      }
    };

    addLog("Initializing Molstar plugin");
    initPlugin();

    // Cleanup function
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
        } catch (e) {
          console.error('Error disposing plugin:', e);
        }
        pluginRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, [addLog, reportError]);

  // Step 2: Load the PDB structure - separate function to avoid infinite loops
  const loadStructure = useCallback(async () => {
    // Skip if plugin isn't initialized
    if (!isInitializedRef.current || !pluginRef.current) {
      return;
    }

    // Prevent concurrent loading
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    setIsLoading(true);
    setError(null);

    try {
      const plugin = pluginRef.current;

      addLog(`Loading structure for PDB ID: ${pdbId}`);

      // Use the local API route which handles repository access
      const url = `/api/pdb/${pdbId.toLowerCase()}`;
      addLog(`Fetching from API: ${url}`);

      // Try to detect format with HEAD request
      let formatName = 'mmcif'; // Default format
      try {
        const headResponse = await fetch(url, { method: 'HEAD' });
        if (headResponse.ok) {
          const format = headResponse.headers.get('X-PDB-Format');
          if (format === 'pdb' || format === 'mmcif') {
            formatName = format;
            addLog(`Detected format from API: ${format}`);
          }
        }
      } catch (headError) {
        addLog(`HEAD request failed, using default format: ${formatName}`);
      }

      // Fetch the actual structure
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch structure: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 100) {
        throw new Error(`Data is too small (${buffer.byteLength} bytes)`);
      }

      addLog(`Downloaded data: ${buffer.byteLength} bytes`);

      // Create data object for Molstar
      const data = await plugin.builders.data.rawData({ data: new Uint8Array(buffer) });

      // Try primary format
      addLog(`Parsing trajectory as ${formatName}`);
      try {
        // Parse trajectory with primary format
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
            plugin.managers.structure.selection.fromSelectionString(`chain ${chainId}`);
            plugin.managers.camera.focusSelection();
            addLog(`Focused on chain ${chainId}`);
          } catch (chainErr) {
            addLog(`Could not focus on chain ${chainId}`);
            plugin.canvas3d?.resetCamera();
          }
        } else {
          plugin.canvas3d?.resetCamera();
        }
      } catch (primaryError) {
        // Try fallback format if primary format fails
        addLog(`${formatName} parsing failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);

        const fallbackFormat = formatName === 'mmcif' ? 'pdb' : 'mmcif';
        addLog(`Trying fallback format: ${fallbackFormat}`);

        const trajectory = await plugin.builders.structure.parseTrajectory(data, fallbackFormat);
        addLog(`${fallbackFormat.toUpperCase()} trajectory parsed successfully`);

        // Apply representation
        await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
          id: 'preset-structure-representation-cartoon',
          params: {}
        });

        // Reset camera
        plugin.canvas3d?.resetCamera();
      }

      // Structure loaded successfully
      addLog("Structure loaded successfully");
      setIsLoading(false);
      isLoadingRef.current = false;
      if (onReady) onReady(plugin);
    } catch (error) {
      // Handle any errors during loading
      const errorMessage = error instanceof Error ? error.message : String(error);
      reportError(errorMessage);
    }
  }, [pdbId, chainId, addLog, reportError, onReady]);

  // Step 3: Load structure when PDB ID changes
  useEffect(() => {
    // Only try to load if plugin is initialized and we're not already loading
    if (isInitializedRef.current && !isLoadingRef.current) {
      loadStructure();
    }
  }, [pdbId, chainId, loadStructure]);

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
    </div>
  );
}
