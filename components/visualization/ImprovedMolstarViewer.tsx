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
  // Component state
  const [status, setStatus] = useState<'initializing' | 'loading' | 'ready' | 'error'>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const pdbIdRef = useRef(pdbId);
  const chainIdRef = useRef(chainId);

  // Update refs when props change
  useEffect(() => {
    pdbIdRef.current = pdbId;
    chainIdRef.current = chainId;
  }, [pdbId, chainId]);

  // Safe state update functions
  const safeSetStatus = useCallback((newStatus: 'initializing' | 'loading' | 'ready' | 'error') => {
    if (mountedRef.current) {
      setStatus(newStatus);
    }
  }, []);

  const safeSetError = useCallback((errorMessage: string | null) => {
    if (mountedRef.current) {
      setError(errorMessage);
      if (errorMessage && onError) onError(errorMessage);
    }
  }, [onError]);

  const addLog = useCallback((message: string) => {
    if (mountedRef.current) {
      console.log(`[MolstarViewer] ${message}`);
      setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
    }
  }, []);

  // Add inline CSS for Molstar
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

      // Also try to load external CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/molstar.css';
      document.head.appendChild(link);
    }
  }, []);

  // Debug function
  const debugStructure = useCallback(() => {
    if (!pluginRef.current) {
      addLog("Cannot debug: Plugin not initialized");
      return;
    }

    try {
      const plugin = pluginRef.current;

      addLog("------------- DEBUG INFO -------------");
      addLog(`Component status: ${status}`);
      addLog(`Current PDB ID: ${pdbIdRef.current}`);
      addLog(`Current chain ID: ${chainIdRef.current || 'none'}`);
      addLog(`Canvas ref exists: ${!!canvasRef.current}`);
      addLog(`Container ref exists: ${!!containerRef.current}`);

      // Plugin state
      addLog(`Canvas3D exists: ${!!plugin.canvas3d}`);
      addLog(`Plugin state: ${plugin.state.isAnimating ? 'Animating' : 'Static'}`);

      if (plugin.canvas3d) {
        const cameraState = plugin.canvas3d.camera.state;
        addLog(`Camera position: ${JSON.stringify(cameraState.position)}`);
        addLog(`Camera target: ${JSON.stringify(cameraState.target)}`);
      }

      // Structure info
      const structures = plugin.managers?.structure?.hierarchy?.current?.structures || [];
      addLog(`Number of structures: ${structures.length}`);

      if (structures.length > 0) {
        structures.forEach((s, i) => {
          addLog(`Structure ${i+1}: ${s.obj?.data?.label || 'Unnamed'}`);
          addLog(`- Atoms: ${s.obj?.data?.models?.[0]?.atomCount || 'unknown'}`);
          addLog(`- Chains: ${s.obj?.data?.models?.[0]?.chains.length || 'unknown'}`);
        });
      }

      addLog("-----------------------------------");
    } catch (error) {
      addLog(`Debug error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [addLog, status]);

  // Initialization and loading logic in a single effect
  useEffect(() => {
    // Skip if refs aren't ready
    if (!canvasRef.current || !containerRef.current) {
      return;
    }

    // Reset mounted ref
    mountedRef.current = true;

    let timeoutId: NodeJS.Timeout | null = null;
    let debugTimeoutId: NodeJS.Timeout | null = null;

    // Main function to initialize plugin and load structure
    const initAndLoad = async () => {
      try {
        // Start initialization
        safeSetStatus('initializing');
        addLog("Initializing Molstar plugin");

        // Import Molstar libraries
        const { DefaultPluginSpec } = await import('molstar/lib/mol-plugin/spec');
        const { PluginContext } = await import('molstar/lib/mol-plugin/context');

        // Create and initialize plugin
        const plugin = new PluginContext(DefaultPluginSpec());
        await plugin.init();
        pluginRef.current = plugin;

        // Initialize viewer
        addLog("Initializing viewer canvas");
        const viewerInitialized = plugin.initViewer(canvasRef.current, containerRef.current);

        if (!viewerInitialized) {
          throw new Error('Failed to initialize Molstar viewer');
        }

        // Set background color (white)
        plugin.canvas3d?.setProps({
          backgroundColor: { color: 0xFFFFFF }
        });

        addLog("Plugin initialization complete, preparing to load structure");

        // Load structure
        safeSetStatus('loading');
        addLog(`Loading structure for PDB ID: ${pdbIdRef.current}`);

        // Add loading timeout
        timeoutId = setTimeout(() => {
          if (mountedRef.current && status === 'loading') {
            addLog("Loading timeout reached (20 seconds)");
            safeSetStatus('error');
            safeSetError("Loading timed out after 20 seconds. The structure may be too large or not available.");
          }
        }, 20000);

        // Add debug timeout (runs after 10 seconds of loading)
        debugTimeoutId = setTimeout(() => {
          if (mountedRef.current && status === 'loading') {
            addLog("Auto-debug after 10 seconds of loading");
            debugStructure();
          }
        }, 10000);

        // Use API to load structure
        const url = `/api/pdb/${pdbIdRef.current.toLowerCase()}`;
        addLog(`Fetching from API: ${url}`);

        // Try HEAD request for format detection
        let formatName = 'mmcif'; // Default format
        try {
          const headResponse = await fetch(url, { method: 'HEAD' });
          if (headResponse.ok) {
            const format = headResponse.headers.get('X-PDB-Format');
            if (format === 'pdb' || format === 'mmcif') {
              formatName = format;
              addLog(`Format from header: ${format}`);
            }
          }
        } catch (headError) {
          addLog(`HEAD request failed: ${headError instanceof Error ? headError.message : String(headError)}`);
        }

        // Main data fetch
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch structure: ${response.status} ${response.statusText}`);
        }

        // Log response info
        addLog(`Response status: ${response.status}`);
        addLog(`Content type: ${response.headers.get('Content-Type') || 'not specified'}`);

        // Get data
        const buffer = await response.arrayBuffer();
        if (!buffer || buffer.byteLength === 0) {
          throw new Error('Empty response received from API');
        }

        addLog(`Downloaded ${buffer.byteLength} bytes`);

        // Inspect first bytes to help determine format
        const dataView = new DataView(buffer);
        let firstBytes = '';
        const bytesToShow = Math.min(20, buffer.byteLength);
        for (let i = 0; i < bytesToShow; i++) {
          firstBytes += String.fromCharCode(dataView.getUint8(i));
        }
        addLog(`First bytes: ${firstBytes}`);

        // Adjust format based on content inspection
        if (firstBytes.includes('HEADER') || firstBytes.includes('ATOM')) {
          formatName = 'pdb';
          addLog('Content appears to be PDB format');
        } else if (firstBytes.includes('data_') || firstBytes.includes('loop_')) {
          formatName = 'mmcif';
          addLog('Content appears to be mmCIF format');
        }

        // Create data object
        const data = await plugin.builders.data.rawData({
          data: new Uint8Array(buffer),
          label: `${pdbIdRef.current}.${formatName === 'mmcif' ? 'cif' : 'pdb'}`
        });

        // Try to parse with detected format
        let success = false;

        try {
          addLog(`Parsing as ${formatName}`);
          const trajectory = await plugin.builders.structure.parseTrajectory(data, formatName);
          addLog('Trajectory parsed successfully');

          await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
            id: 'preset-structure-representation-cartoon',
            params: {}
          });

          // Handle chain selection if specified
          if (chainIdRef.current) {
            try {
              addLog(`Selecting chain: ${chainIdRef.current}`);
              plugin.managers.structure.selection.fromSelectionString(`chain ${chainIdRef.current}`);
              plugin.managers.camera.focusSelection();
            } catch (chainErr) {
              addLog(`Chain selection failed: ${chainErr instanceof Error ? chainErr.message : String(chainErr)}`);
              plugin.canvas3d?.resetCamera();
            }
          } else {
            plugin.canvas3d?.resetCamera();
          }

          success = true;
        } catch (primaryError) {
          // Primary format failed, try fallback
          addLog(`Primary format (${formatName}) failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);

          const fallbackFormat = formatName === 'mmcif' ? 'pdb' : 'mmcif';
          addLog(`Trying fallback format: ${fallbackFormat}`);

          try {
            const trajectory = await plugin.builders.structure.parseTrajectory(data, fallbackFormat);
            addLog('Fallback parsing successful');

            await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
              id: 'preset-structure-representation-cartoon',
              params: {}
            });

            plugin.canvas3d?.resetCamera();
            success = true;
          } catch (fallbackError) {
            addLog(`Fallback format also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
            throw new Error(`Failed to parse structure. Tried both ${formatName} and ${fallbackFormat} formats.`);
          }
        }

        // If we got here without an error, the structure loaded successfully
        if (success) {
          addLog("Structure loaded successfully");
          safeSetStatus('ready');
          safeSetError(null);

          if (onReady && mountedRef.current) {
            onReady(plugin);
          }
        }
      } catch (error) {
        // Handle any errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        addLog(`Error: ${errorMessage}`);

        if (mountedRef.current) {
          safeSetStatus('error');
          safeSetError(errorMessage);
        }
      }
    };

    // Start the initialization process
    initAndLoad();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;

      // Clear any pending timeouts
      if (timeoutId) clearTimeout(timeoutId);
      if (debugTimeoutId) clearTimeout(debugTimeoutId);

      // Dispose plugin if it exists
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
          pluginRef.current = null;
        } catch (error) {
          console.error('Error disposing Molstar plugin:', error);
        }
      }
    };
  }, [pdbId, chainId, addLog, safeSetStatus, safeSetError, debugStructure, onReady, status]);

  // Component rendering
  return (
    <div className="relative" style={{ width, height }}>
      {/* Loading spinner */}
      {(status === 'initializing' || status === 'loading') && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{status === 'initializing' ? 'Initializing viewer...' : 'Loading structure...'}</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {status === 'error' && error && (
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

      {/* Canvas container */}
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
