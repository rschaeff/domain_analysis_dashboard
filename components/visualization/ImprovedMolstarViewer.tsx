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
  // React state for component status
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);

  // Refs for imperative operations
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any>(null);

  // Debug logging function (writes to both console and UI)
  const logDebug = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logMessage = `${timestamp} - ${message}`;

    // Write to console
    if (level === 'info') console.log(`[Molstar] ${logMessage}`);
    if (level === 'warn') console.warn(`[Molstar] ${logMessage}`);
    if (level === 'error') console.error(`[Molstar] ${logMessage}`);

    // Update React state
    setLogs(prev => [...prev, logMessage]);

    // Also write directly to DOM for cases where React might be frozen
    if (logContainerRef.current) {
      const logElement = document.createElement('div');
      logElement.className = level === 'error' ? 'text-red-500' :
                            level === 'warn' ? 'text-yellow-500' : 'text-gray-700';
      logElement.textContent = logMessage;
      logContainerRef.current.appendChild(logElement);
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, []);

  // Error handler
  const handleError = useCallback((errorMessage: string) => {
    logDebug(`ERROR: ${errorMessage}`, 'error');
    setError(errorMessage);
    setLoading(false);
    if (onError) onError(errorMessage);
  }, [logDebug, onError]);

  // Manual reload handler
  const handleReload = useCallback(() => {
    logDebug('Manual reload triggered by user');
    setError(null);
    setInitialized(false);
    setLoading(false);

    // Force cleanup of existing plugin
    if (pluginRef.current) {
      try {
        logDebug('Disposing previous plugin instance');
        pluginRef.current.dispose();
        pluginRef.current = null;
      } catch (e) {
        logDebug(`Error disposing plugin: ${e instanceof Error ? e.message : String(e)}`, 'error');
      }
    }

    // Force component re-mount via key change
    setForceUpdateKey(prev => prev + 1);
  }, [logDebug]);

  // Structure loading function
  const loadStructure = useCallback(async (targetPlugin: any, targetPdbId: string, targetChainId?: string) => {
    if (!targetPlugin) {
      logDebug('Cannot load structure: plugin not initialized', 'error');
      return false;
    }

    setLoading(true);
    logDebug(`Loading structure for PDB ID: ${targetPdbId}${targetChainId ? `, Chain: ${targetChainId}` : ''}`);

    try {
      // Use API to fetch structure
      const url = `/api/pdb/${targetPdbId.toLowerCase()}`;
      logDebug(`Fetching from API: ${url}`);

      // Try to determine format with HEAD request
      let formatName = 'mmcif'; // Default format
      try {
        logDebug('Making HEAD request for format detection');
        const headResponse = await fetch(url, { method: 'HEAD' });

        if (headResponse.ok) {
          // Log all headers for debugging
          headResponse.headers.forEach((value, key) => {
            logDebug(`Header: ${key} = ${value}`);
          });

          const format = headResponse.headers.get('X-PDB-Format');
          if (format === 'pdb' || format === 'mmcif') {
            formatName = format;
            logDebug(`Format detected from header: ${format}`);
          } else {
            logDebug(`No format detected from header, using default: ${formatName}`);
          }
        } else {
          logDebug(`HEAD request failed: ${headResponse.status} ${headResponse.statusText}`, 'warn');
        }
      } catch (headError) {
        logDebug(`HEAD request error: ${headError instanceof Error ? headError.message : String(headError)}`, 'warn');
      }

      // Fetch the actual data
      logDebug('Starting main fetch request');
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }

      logDebug(`Fetch response status: ${response.status}`);
      logDebug(`Content type: ${response.headers.get('Content-Type') || 'not specified'}`);

      // Get data as ArrayBuffer
      const buffer = await response.arrayBuffer();

      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Empty response received from API');
      }

      logDebug(`Downloaded ${buffer.byteLength} bytes`);

      // Debug: Inspect first bytes for format detection
      const dataView = new DataView(buffer);
      let firstBytes = '';
      const bytesToShow = Math.min(40, buffer.byteLength);
      for (let i = 0; i < bytesToShow; i++) {
        const byte = dataView.getUint8(i);
        // Only include printable ASCII
        if (byte >= 32 && byte <= 126) {
          firstBytes += String.fromCharCode(byte);
        } else if (byte === 10 || byte === 13) {
          firstBytes += '\\n';
        } else {
          firstBytes += `\\x${byte.toString(16).padStart(2, '0')}`;
        }
      }
      logDebug(`First bytes: ${firstBytes}`);

      // Content-based format detection
      if (firstBytes.includes('HEADER') || firstBytes.includes('ATOM')) {
        formatName = 'pdb';
        logDebug('Content appears to be PDB format');
      } else if (firstBytes.includes('data_') || firstBytes.includes('loop_')) {
        formatName = 'mmcif';
        logDebug('Content appears to be mmCIF format');
      }

      // Create data object for Molstar
      logDebug(`Creating data object (format: ${formatName})`);
      const data = await targetPlugin.builders.data.rawData({
        data: new Uint8Array(buffer),
        label: `${targetPdbId}.${formatName === 'mmcif' ? 'cif' : 'pdb'}`
      });

      // Try primary format
      try {
        logDebug(`Parsing structure as ${formatName}`);
        const trajectory = await targetPlugin.builders.structure.parseTrajectory(data, formatName);
        logDebug('Trajectory parsed successfully');

        // Apply representation
        logDebug('Applying cartoon representation');
        await targetPlugin.builders.structure.hierarchy.applyPreset(trajectory, {
          id: 'preset-structure-representation-cartoon',
          params: {}
        });

        // Handle chain selection
        if (targetChainId) {
          try {
            logDebug(`Focusing on chain ${targetChainId}`);
            targetPlugin.managers.structure.selection.fromSelectionString(`chain ${targetChainId}`);
            targetPlugin.managers.camera.focusSelection();
          } catch (chainErr) {
            logDebug(`Chain selection failed: ${chainErr instanceof Error ? chainErr.message : String(chainErr)}`, 'warn');
            targetPlugin.canvas3d?.resetCamera();
          }
        } else {
          targetPlugin.canvas3d?.resetCamera();
        }

        logDebug('Structure loaded successfully');
        return true;
      } catch (primaryError) {
        // Primary format failed, try fallback
        logDebug(`Primary format (${formatName}) failed: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`, 'warn');

        // Try fallback format
        const fallbackFormat = formatName === 'mmcif' ? 'pdb' : 'mmcif';
        logDebug(`Trying fallback format: ${fallbackFormat}`);

        try {
          const trajectory = await targetPlugin.builders.structure.parseTrajectory(data, fallbackFormat);
          logDebug('Fallback parsing successful');

          await targetPlugin.builders.structure.hierarchy.applyPreset(trajectory, {
            id: 'preset-structure-representation-cartoon',
            params: {}
          });

          targetPlugin.canvas3d?.resetCamera();
          logDebug('Structure loaded successfully (using fallback format)');
          return true;
        } catch (fallbackError) {
          logDebug(`Fallback format also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`, 'error');
          throw new Error(`Failed to parse structure in both formats. Primary error: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logDebug(`Load structure error: ${errorMessage}`, 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [logDebug]);

  // Debug helper function
  const debugPlugin = useCallback(() => {
    if (!pluginRef.current) {
      logDebug('Cannot debug: plugin not initialized', 'warn');
      return;
    }

    try {
      const plugin = pluginRef.current;

      logDebug('------------- DEBUG INFO -------------');
      logDebug(`Initialized: ${initialized}`);
      logDebug(`Loading: ${loading}`);
      logDebug(`Canvas ref: ${!!canvasRef.current}`);
      logDebug(`Container ref: ${!!containerRef.current}`);

      if (plugin.canvas3d) {
        logDebug('Canvas3D is available');
        const cameraState = plugin.canvas3d.camera.state;
        logDebug(`Camera position: ${JSON.stringify(cameraState.position)}`);
        logDebug(`Camera target: ${JSON.stringify(cameraState.target)}`);
      } else {
        logDebug('Canvas3D is NOT available', 'warn');
      }

      // Check structures
      const structures = plugin.managers?.structure?.hierarchy?.current?.structures || [];
      logDebug(`Number of structures: ${structures.length}`);

      if (structures.length > 0) {
        structures.forEach((s: any, i: number) => {
          logDebug(`Structure ${i+1}: ${s.obj?.data?.label || 'Unnamed'}`);
          logDebug(`- Atoms: ${s.obj?.data?.models?.[0]?.atomCount || 'unknown'}`);
          logDebug(`- Chains: ${s.obj?.data?.models?.[0]?.chains.length || 'unknown'}`);
        });
      }

      // Try to manually reset camera
      if (plugin.canvas3d) {
        logDebug('Attempting to reset camera');
        plugin.canvas3d.resetCamera();
        plugin.canvas3d.commit();
      }

      logDebug('-----------------------------------');
    } catch (error) {
      logDebug(`Debug error: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }, [initialized, loading, logDebug]);

  // Effect 1: Add CSS styles (run once)
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

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/molstar.css';
      document.head.appendChild(link);
    }
  }, []);

  // Effect 2: Initialize plugin (run once per mount)
  useEffect(() => {
    // Skip if already initialized or refs not ready
    if (initialized || !canvasRef.current || !containerRef.current) {
      return;
    }

    let isMounted = true;

    logDebug('Starting plugin initialization');

    // Initialize Molstar plugin
    const initPlugin = async () => {
      try {
        // Import Molstar libraries
        logDebug('Importing Molstar modules');
        const { DefaultPluginSpec } = await import('molstar/lib/mol-plugin/spec');
        const { PluginContext } = await import('molstar/lib/mol-plugin/context');

        // Create plugin instance
        logDebug('Creating plugin instance');
        const plugin = new PluginContext(DefaultPluginSpec());

        // Initialize the plugin
        logDebug('Initializing plugin');
        await plugin.init();

        // Initialize the viewer
        logDebug('Setting up viewer');
        const viewerInitialized = plugin.initViewer(canvasRef.current, containerRef.current);

        if (!viewerInitialized) {
          throw new Error('Failed to initialize viewer');
        }

        // Set background color
        plugin.canvas3d?.setProps({
          backgroundColor: { color: 0xFFFFFF }
        });

        // Store plugin reference and mark as initialized
        if (isMounted) {
          pluginRef.current = plugin;
          logDebug('Plugin initialized successfully');
          setInitialized(true);
        } else {
          // Clean up if component unmounted during async operation
          logDebug('Component unmounted during initialization', 'warn');
          plugin.dispose();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (isMounted) {
          handleError(`Initialization error: ${errorMessage}`);
        }
      }
    };

    initPlugin();

    // Cleanup function
    return () => {
      isMounted = false;
      if (pluginRef.current && !initialized) {
        try {
          pluginRef.current.dispose();
          pluginRef.current = null;
        } catch (e) {
          console.error('Error disposing plugin during cleanup:', e);
        }
      }
    };
  }, [initialized, handleError, logDebug, forceUpdateKey]);

  // Effect 3: Load structure when initialized or pdbId changes
  useEffect(() => {
    // Only run when plugin is initialized
    if (!initialized || !pluginRef.current) {
      return;
    }

    let isMounted = true;

    const doLoadStructure = async () => {
      try {
        const success = await loadStructure(pluginRef.current, pdbId, chainId);

        if (success && isMounted) {
          // Structure loaded successfully
          if (onReady) onReady(pluginRef.current);
        }
      } catch (error) {
        if (isMounted) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          handleError(`Failed to load structure: ${errorMessage}`);
        }
      }
    };

    doLoadStructure();

    return () => {
      isMounted = false;
    };
  }, [initialized, pdbId, chainId, loadStructure, handleError, onReady]);

  // Effect 4: Set up timeouts for loading and debugging
  useEffect(() => {
    if (!loading) return;

    logDebug('Setting up loading timeouts');

    // Set timeouts for debugging and loading
    const debugTimeoutId = setTimeout(() => {
      if (loading) {
        logDebug('Auto-debug triggered after 10s of loading', 'warn');
        debugPlugin();
      }
    }, 10000);

    const loadingTimeoutId = setTimeout(() => {
      if (loading) {
        logDebug('Loading timeout reached (20s)', 'error');
        handleError('Loading timed out after 20 seconds. The structure may be too large or not available.');
      }
    }, 20000);

    return () => {
      clearTimeout(debugTimeoutId);
      clearTimeout(loadingTimeoutId);
    };
  }, [loading, debugPlugin, handleError, logDebug]);

  // Effect 5: Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pluginRef.current) {
        try {
          logDebug('Component unmounting - disposing plugin');
          pluginRef.current.dispose();
          pluginRef.current = null;
        } catch (e) {
          console.error('Error during plugin disposal:', e);
        }
      }
    };
  }, [logDebug]);

  return (
    <div className="relative" style={{ width, height }}>
      {/* Loading indicator */}
      {(loading || !initialized) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <div className="flex flex-col items-center">
            <div className="flex items-center mb-4">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{!initialized ? 'Initializing viewer...' : 'Loading structure...'}</span>
            </div>

            {/* Show reload button if loading takes too long */}
            {loading && (
              <button
                onClick={handleReload}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm"
              >
                Force Reload
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-red-500 bg-white p-4 rounded shadow max-w-md">
            <p className="font-bold mb-2">Error:</p>
            <p className="mb-2">{error}</p>
            <button
              onClick={handleReload}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm"
            >
              Try Again
            </button>
            <details className="text-xs text-gray-600 mt-2" open>
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

      {/* Debug log container (for when React is frozen) */}
      <div
        ref={logContainerRef}
        className="absolute bottom-0 left-0 right-0 z-20 bg-white bg-opacity-90 text-xs font-mono overflow-y-auto"
        style={{
          maxHeight: '100px',
          display: process.env.NODE_ENV === 'development' ? 'block' : 'none'
        }}
      />

      {/* Main canvas container */}
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

      {/* Debug button (DEV only) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={debugPlugin}
          className="absolute top-2 left-2 z-30 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-50 hover:opacity-100"
        >
          Debug
        </button>
      )}
    </div>
  );
}
