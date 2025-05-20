'use client'

import React, { useEffect, useRef, useState } from 'react'

// Component with explicit debugging for Molstar canvas rendering
export default function MinimalMolstarDebug() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [cssLoaded, setCssLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add a log entry
  const addLog = (message: string) => {
    console.log(`[Molstar Debug] ${message}`);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${message}`]);
  };

  useEffect(() => {
    addLog("Component mounted");
    
    // Force explicit dimensions on container and canvas
    if (containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      addLog(`Container size: ${containerRect.width}x${containerRect.height}`);
    }
    
    if (canvasRef.current) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      addLog(`Canvas size: ${canvasRect.width}x${canvasRect.height}`);
      
      // Force explicit canvas styling to ensure visibility
      canvasRef.current.style.border = '3px solid red';
      canvasRef.current.style.backgroundColor = '#f0f0f0';
    }

    // 1. Load Molstar CSS directly
    addLog("Loading Molstar CSS");
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    //link.href = 'https://cdn.jsdelivr.net/npm/molstar@3.44.0/build/viewer/molstar.css';
    //link.href = 'https://unpkg.com/molstar@3.44.0/build/viewer/molstar.css';
    link.href = '/css/molstar.css';
    link.onload = () => {
      addLog("✅ Molstar CSS loaded");
      setCssLoaded(true);
    };
    link.onerror = () => {
      const msg = "❌ Failed to load Molstar CSS";
      addLog(msg);
      setError(msg);
    };
    document.head.appendChild(link);

    // 2. Initialize Molstar only after CSS is loaded
    const initMolstar = async () => {
      try {
        // Import Molstar libraries with explicit error handling
        addLog("Loading Molstar libraries");
        let DefaultPluginSpec, PluginContext;
        
        try {
          DefaultPluginSpec = (await import('molstar/lib/mol-plugin/spec')).DefaultPluginSpec;
          PluginContext = (await import('molstar/lib/mol-plugin/context')).PluginContext;
          addLog("✅ Molstar libraries loaded");
        } catch (importError) {
          throw new Error(`Failed to import Molstar libraries: ${importError instanceof Error ? importError.message : String(importError)}`);
        }

        // Create plugin instance
        addLog("Creating Molstar plugin");
        const plugin = new PluginContext(DefaultPluginSpec());
        addLog("Initializing plugin");
        await plugin.init();
        addLog("✅ Plugin initialized");

        // Check WebGL support
        addLog("Checking WebGL support");
        const canvas = canvasRef.current;
        if (!canvas) {
          throw new Error("Canvas reference not available");
        }

        // Try to get WebGL context manually to verify it works
        try {
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) {
            throw new Error("WebGL not supported by browser");
          }
          addLog(`✅ WebGL context created successfully (version: ${gl.getParameter(gl.VERSION)})`);
        } catch (webglError) {
          throw new Error(`WebGL context check failed: ${webglError instanceof Error ? webglError.message : String(webglError)}`);
        }

        // Initialize viewer with explicit context
        addLog("Initializing viewer with canvas");
        const parent = containerRef.current;
        if (!parent) {
          throw new Error("Container reference not available");
        }
        
        // Before initialization, log container/canvas state
        const containerRect = parent.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        addLog(`Container size before init: ${containerRect.width}x${containerRect.height}`);
        addLog(`Canvas size before init: ${canvasRect.width}x${canvasRect.height}`);
        
        // Initialize viewer
        const viewerInitialized = plugin.initViewer(canvas, parent);
        if (!viewerInitialized) {
          throw new Error("Failed to initialize viewer");
        }
        addLog("✅ Viewer initialized");

        // Set background color to clearly show if rendering is happening
        plugin.canvas3d?.setProps({
          backgroundColor: { color: 0x3498DB }
        });
        addLog("Background color set to blue");

        // Load simple structure (PDB)
        addLog("Loading PDB structure (1cbs)");
        try {
          const url = 'https://files.rcsb.org/download/1cbs.pdb';
          const data = await plugin.builders.data.download({ url });
          addLog("✅ Structure data downloaded");
          
          const trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb');
          addLog("✅ Trajectory parsed");
          
          const structure = await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default');
          addLog("✅ Structure loaded and rendered");
          
          // Focus camera
          plugin.canvas3d?.resetCamera();
          addLog("Camera reset");
        } catch (loadError) {
          throw new Error(`Failed to load structure: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        addLog(`❌ Error: ${errorMessage}`);
        setError(errorMessage);
      }
    };

    // Wait for CSS to load before initializing Molstar
    if (cssLoaded) {
      initMolstar();
    }

    // Cleanup
    return () => {
      addLog("Component unmounting - cleanup");
    };
  }, [cssLoaded]);

  return (
    <div className="p-4 border-2 border-black">
      <h1 className="text-xl font-bold mb-4">Molstar Debug Canvas</h1>
      
      {/* Debug information */}
      <div className="mb-4">
        <div className="bg-gray-100 p-2 mb-2 rounded">
          <span className="font-semibold">CSS Loaded:</span> {cssLoaded ? '✅' : '❌'}
        </div>
        {error && (
          <div className="bg-red-100 text-red-800 p-2 mb-2 rounded">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}
      </div>
      
      {/* Container with explicit dimensions */}
      <div 
        ref={containerRef} 
        className="border-4 border-blue-500 relative mb-4"
        style={{ width: '500px', height: '300px' }}
      >
        {/* Canvas with explicit styling */}
        <canvas 
          ref={canvasRef}
          className="border-2 border-orange-500"
          style={{ 
            width: '100%', 
            height: '100%', 
            position: 'absolute',
            top: 0,
            left: 0
          }}
        />
        
        {/* Overlay text to confirm container is rendering */}
        <div className="absolute top-0 left-0 bg-white/70 p-1 text-xs z-10">
          Molstar Canvas Container
        </div>
      </div>
      
      {/* Log display */}
      <div className="border border-gray-300 rounded">
        <div className="bg-gray-200 px-3 py-1 font-medium">Initialization Logs</div>
        <div className="h-64 overflow-y-auto p-2 bg-black text-green-400 font-mono text-xs">
          {logs.map((log, index) => (
            <div key={index}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
