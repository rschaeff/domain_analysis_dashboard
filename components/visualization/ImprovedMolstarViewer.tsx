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

// Add debug button to display in dev environment
  const debugStructure = useCallback(() => {
    if (!pluginRef.current) {
      addLog("Plugin not initialized, cannot debug");
      return;
    }

    try {
      // Try to log state of the viewer
      const plugin = pluginRef.current;

      addLog("------------- DEBUG INFO -------------");
      addLog(`Plugin initialized: ${isInitializedRef.current}`);
      addLog(`Loading ref: ${isLoadingRef.current}`);
      addLog(`Loading state: ${isLoading}`);
      addLog(`Canvas: ${!!canvasRef.current}`);
      addLog(`Container: ${!!containerRef.current}`);

      // Log state of plugin components
      addLog(`Canvas3D: ${!!plugin.canvas3d}`);
      addLog(`Plugin state: ${plugin.state.isAnimating ? 'Animating' : 'Static'}`);

      if (plugin.canvas3d) {
        // Get camera state
        const cameraState = plugin.canvas3d.camera.state;
        addLog(`Camera position: ${JSON.stringify(cameraState.position)}`);
        addLog(`Camera target: ${JSON.stringify(cameraState.target)}`);
      }

      // Check if we have any structures
      const structures = plugin.managers?.structure?.hierarchy?.current?.structures || [];
      addLog(`Number of structures: ${structures.length}`);

      if (structures.length > 0) {
        addLog("Structure details:");
        structures.forEach((s, i) => {
          addLog(`Structure ${i+1}: ${s.obj?.data?.label || 'Unnamed'}`);
          addLog(`- Atoms: ${s.obj?.data?.models?.[0]?.atomCount || 'unknown'}`);
          addLog(`- Chains: ${s.obj?.data?.models?.[0]?.chains.length || 'unknown'}`);
        });
      }

      // Try to manually reset camera
      if (plugin.canvas3d) {
        addLog("Attempting to reset camera");
        plugin.canvas3d.resetCamera();
        plugin.canvas3d.commit();
      }

      addLog("-----------------------------------");

    } catch (error) {
      addLog(`Debug error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [addLog, isInitializedRef, isLoadingRef, isLoading]);

  // Debug timer - automatically run debug after 10 seconds if still loading
  useEffect(() => {
    if (isLoading && isLoadingRef.current) {
      const debugTimerId = setTimeout(() => {
        // Only debug if we're still loading
        if (isLoadingRef.current) {
          addLog("Auto-running debug after 10 seconds of loading");
          debugStructure();
        }
      }, 10000); // 10 second timeout

      return () => clearTimeout(debugTimerId);
    }
  }, [isLoading, addLog, debugStructure]);  // Add a timeout for the loading process
  useEffect(() => {
    if (isLoading && isLoadingRef.current) {
      // Set a timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        // Only update if we're still loading
        if (isLoadingRef.current) {
          addLog("Loading timeout reached (20 seconds) - forcing reset");
          setIsLoading(false);
          isLoadingRef.current = false;
          reportError("Structure loading timed out after 20 seconds. Try a different structure or check network connectivity.");
        }
      }, 20000); // 20 second timeout

      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, addLog, reportError]);



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
      addLog("Plugin not initialized yet, cannot load structure");
      return;
    }

    // Prevent concurrent loading
    if (isLoadingRef.current) {
      addLog("Already loading, skipping duplicate request");
      return;
    }

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
        addLog("Making HEAD request to determine format");
        const headResponse = await fetch(url, { method: 'HEAD' });
        if (headResponse.ok) {
          const format = headResponse.headers.get('X-PDB-Format');
          if (format === 'pdb' || format === 'mmcif') {
            formatName = format;
            addLog(`Detected format from API: ${format}`);
          } else {
            addLog(`No format detected from header, using default: ${formatName}`);
          }
        } else {
          addLog(`HEAD request failed with status: ${headResponse.status}, using default format`);
        }
      } catch (headError) {
        addLog(`HEAD request failed with error: ${headError instanceof Error ? headError.message : String(headError)}`);
        addLog(`Using default format: ${formatName}`);
      }

      // Fetch the actual structure
      addLog("Fetching structure data");
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch structure: ${response.status} ${response.statusText}`);
      }

      // Check content type header
      const contentType = response.headers.get('Content-Type');
      addLog(`Response content type: ${contentType || 'unknown'}`);

      // Get the data as ArrayBuffer
      const buffer = await response.arrayBuffer();

      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Empty response received from API');
      }

      if (buffer.byteLength < 100) {
        addLog(`Warning: Data is very small (${buffer.byteLength} bytes), might not be a valid structure`);
      }

      addLog(`Downloaded data: ${buffer.byteLength} bytes`);

      // Debug the first few bytes to see what kind of data we're getting
      const dataView = new DataView(buffer);
      let firstBytes = '';
      const bytesToShow = Math.min(20, buffer.byteLength);
      for (let i = 0; i < bytesToShow; i++) {
        firstBytes += String.fromCharCode(dataView.getUint8(i));
      }
      addLog(`First ${bytesToShow} bytes: ${firstBytes}`);

      // Adjust format based on content if needed
      if (firstBytes.includes('HEADER') || firstBytes.includes('ATOM')) {
        addLog('Data appears to be in PDB format based on content');
        formatName = 'pdb';
      } else if (firstBytes.includes('data_') || firstBytes.includes('loop_')) {
        addLog('Data appears to be in mmCIF format based on content');
        formatName = 'mmcif';
      }

      // Create data object for Molstar
      addLog(`Creating data object for Molstar`);
      const data = await plugin.builders.data.rawData({
        data: new Uint8Array(buffer),
        label: `${pdbId}.${formatName === 'mmcif' ? 'cif' : 'pdb'}`
      });

      // Try primary format with detailed error logging
      addLog(`Parsing trajectory as ${formatName}`);
      try {
        // Parse trajectory with primary format
        const trajectory = await plugin.builders.structure.parseTrajectory(data, formatName);
        addLog(`${formatName.toUpperCase()} trajectory parsed successfully`);

        // Apply representation
        addLog('Applying cartoon representation');
        await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
          id: 'preset-structure-representation-cartoon',
          params: {}
        });

        // Handle chain selection
        if (chainId) {
          try {
            addLog(`Focusing on chain ${chainId}`);
            plugin.managers.structure.selection.fromSelectionString(`chain ${chainId}`);
            plugin.managers.camera.focusSelection();
            addLog(`Focused on chain ${chainId}`);
          } catch (chainErr) {
            addLog(`Could not focus on chain ${chainId}: ${chainErr instanceof Error ? chainErr.message : String(chainErr)}`);
            plugin.canvas3d?.resetCamera();
          }
        } else {
          addLog('Resetting camera to show full structure');
          plugin.canvas3d?.resetCamera();
        }
      } catch (primaryError) {
        // Log detailed error
        addLog(`${formatName} parsing failed with error: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
        if (primaryError instanceof Error && primaryError.stack) {
          addLog(`Error stack: ${primaryError.stack}`);
        }

        // Try fallback format if primary format fails
        const fallbackFormat = formatName === 'mmcif' ? 'pdb' : 'mmcif';
        addLog(`Trying fallback format: ${fallbackFormat}`);

        try {
          const trajectory = await plugin.builders.structure.parseTrajectory(data, fallbackFormat);
          addLog(`${fallbackFormat.toUpperCase()} trajectory parsed successfully with fallback`);

          // Apply representation
          await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
            id: 'preset-structure-representation-cartoon',
            params: {}
          });

          // Reset camera
          plugin.canvas3d?.resetCamera();
        } catch (fallbackError) {
          addLog(`Fallback ${fallbackFormat} parsing also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
          throw new Error(`Failed to parse structure in both ${formatName} and ${fallbackFormat} formats. Original error: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
        }
      }

      // Structure loaded successfully
      addLog("Structure loaded successfully");
      setIsLoading(false);
      isLoadingRef.current = false;
      if (onReady) onReady(plugin);
    } catch (error) {
      // Handle any errors during loading
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`Loading error: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        addLog(`Error stack: ${error.stack}`);
      }
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
