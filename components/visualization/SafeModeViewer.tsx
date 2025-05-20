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

export function SafeModeViewer({
  pdbId,
  chainId,
  height = '400px',
  width = '100%',
  onReady,
  onError
}: MolstarViewerProps) {
  // State
  const [status, setStatus] = useState<'idle' | 'initializing' | 'ready' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [canLoad, setCanLoad] = useState(false);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any>(null);
  
  // Add log entry
  const log = useCallback((message: string) => {
    console.log(`[SafeViewer] ${message}`);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  }, []);
  
  // Handle errors
  const handleError = useCallback((message: string) => {
    console.error(`[SafeViewer] ${message}`);
    setError(message);
    setStatus('error');
    if (onError) onError(message);
  }, [onError]);
  
  // Initialize plugin only - no structure loading
  const initializePlugin = useCallback(async () => {
    if (status !== 'idle' && status !== 'error') return;
    
    if (!canvasRef.current || !containerRef.current) {
      return handleError("Canvas or container ref not available");
    }
    
    setStatus('initializing');
    log('Starting initialization...');
    
    try {
      // Import Molstar libraries
      log('Importing modules');
      const { DefaultPluginSpec } = await import('molstar/lib/mol-plugin/spec');
      const { PluginContext } = await import('molstar/lib/mol-plugin/context');
      
      // Create plugin with minimal options
      log('Creating plugin instance');
      const plugin = new PluginContext(DefaultPluginSpec({
        // Specify minimal features to avoid memory issues
        myChemicalLibrary: { useMolj: false },
        extensions: []
      }));
      
      // Initialize
      log('Initializing plugin');
      await plugin.init();
      
      // Setup viewer with explicit canvas sizing
      log('Setting up viewer');
      const viewerInitialized = plugin.initViewer(canvasRef.current, containerRef.current);
      
      if (!viewerInitialized) {
        return handleError('Failed to initialize viewer');
      }
      
      // Set simple white background
      plugin.canvas3d?.setProps({
        backgroundColor: { color: 0xFFFFFF }
      });
      
      // Store reference
      pluginRef.current = plugin;
      
      // Mark as initialized
      log('Initialization complete - ready for manual loading');
      setStatus('ready');
      setCanLoad(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      handleError(`Initialization error: ${errorMessage}`);
    }
  }, [status, handleError, log]);
  
  // Load PDB minimal data
  const loadStructure = useCallback(async () => {
    if (status !== 'ready' || !canLoad || !pluginRef.current) {
      return handleError("Cannot load: plugin not ready");
    }
    
    setStatus('loading');
    log(`Loading structure: ${pdbId}${chainId ? ` chain ${chainId}` : ''}`);
    
    try {
      const plugin = pluginRef.current;
      
      // Use the API to load structure
      const url = `/api/pdb/${pdbId.toLowerCase()}`;
      log(`Fetching from: ${url}`);
      
      try {
        // Explicit fetching with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(url, { 
          signal: controller.signal,
          headers: { 'Accept': 'chemical/x-pdb, chemical/x-mmcif, */*' }
        });
        clearTimeout(timeout);
        
        if (!response.ok) {
          return handleError(`HTTP error: ${response.status} ${response.statusText}`);
        }
        
        // Check the size before processing
        const contentLength = response.headers.get('Content-Length');
        if (contentLength && parseInt(contentLength) > 10000000) {
          return handleError(`Structure too large (${Math.round(parseInt(contentLength)/1024/1024)}MB) - try a smaller structure`);
        }
        
        // Get data format from header or extension
        const contentType = response.headers.get('Content-Type') || '';
        const format = response.headers.get('X-PDB-Format') || '';
        let dataFormat = 'mmcif';
        
        if (format === 'pdb' || contentType.includes('pdb')) {
          dataFormat = 'pdb';
        }
        
        log(`Using format: ${dataFormat}`);
        
        // Get binary data with size limit
        const blob = await response.blob();
        if (blob.size === 0) {
          return handleError('Received empty response from server');
        }
        
        log(`Downloaded ${Math.round(blob.size / 1024)}KB of data`);
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        const data = await plugin.builders.data.rawData({ 
          data: new Uint8Array(arrayBuffer),
          label: `${pdbId.toLowerCase()}.${dataFormat}`
        });
        
        log('Parsing structure...');
        
        // Try parsing with determined format
        let trajectory;
        try {
          trajectory = await plugin.builders.structure.parseTrajectory(data, dataFormat);
          log(`${dataFormat.toUpperCase()} format parsed successfully`);
        } catch (parseError) {
          // Try fallback format
          log(`Error parsing as ${dataFormat}, trying alternative format`);
          const fallbackFormat = dataFormat === 'mmcif' ? 'pdb' : 'mmcif';
          
          trajectory = await plugin.builders.structure.parseTrajectory(data, fallbackFormat);
          log(`${fallbackFormat.toUpperCase()} format parsed successfully`);
        }
        
        // Use simplified representation to reduce memory usage
        log('Applying minimal representation');
        await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
          id: 'preset-structure-representation-backbone',
          params: {}
        });
        
        // Handle chain selection or reset camera
        if (chainId) {
          try {
            log(`Focusing on chain ${chainId}`);
            plugin.managers.structure.selection.fromSelectionString(`chain ${chainId}`);
            plugin.managers.camera.focusSelection();
          } catch (chainErr) {
            log(`Chain selection failed, focusing on whole structure`);
            plugin.canvas3d?.resetCamera();
          }
        } else {
          plugin.canvas3d?.resetCamera();
        }
        
        log('Structure loaded successfully');
        setStatus('ready');
        if (onReady) onReady(plugin);
      } catch (fetchError) {
        handleError(`Structure loading error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }
    } catch (error) {
      handleError(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [pdbId, chainId, status, canLoad, handleError, log, onReady]);
  
  // CSS styling effect
  useEffect(() => {
    // Add minimal CSS directly
    const style = document.createElement('style');
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
      .msp-layout-standard {
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
      }
    `;
    document.head.appendChild(style);
  }, []);
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
          pluginRef.current = null;
        } catch (e) {
          console.error('[SafeViewer] Error during cleanup:', e);
        }
      }
    };
  }, []);
  
  return (
    <div className="relative" style={{ width, height }}>
      {/* Status display */}
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <div className="bg-white p-3 rounded shadow">
            {status === 'idle' && (
              <button
                onClick={initializePlugin}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Initialize Viewer
              </button>
            )}
            
            {status === 'initializing' && (
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Initializing...</span>
              </div>
            )}
            
            {status === 'loading' && (
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading structure...</span>
              </div>
            )}
            
            {status === 'error' && (
              <div className="text-red-600">
                <p className="font-semibold">Error:</p>
                <p>{error}</p>
                <button
                  onClick={initializePlugin}
                  className="mt-2 px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Manual load button */}
      {status === 'ready' && canLoad && (
        <div className="absolute top-2 left-2 z-20">
          <button
            onClick={loadStructure}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Load {pdbId}
          </button>
        </div>
      )}
      
      {/* Logs display */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-black bg-opacity-75 text-green-400 text-xs font-mono p-2" style={{ maxHeight: '100px', overflowY: 'auto' }}>
        {logs.map((log, i) => (
          <div key={i}>{log}</div>
        ))}
      </div>
      
      {/* Main viewer */}
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
