'use client'

import React, { useEffect, useRef, useState } from 'react'

// Component with explicit debugging for Molstar canvas rendering with format detection
export default function FixedMolstarDebug() {
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

    // Also add backup inline CSS
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
    addLog("Added inline CSS as backup");

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

        // Load simple structure - try different formats
        try {
          // Try mmCIF format first (more reliable)
          addLog("Loading PDB structure in mmCIF format (1cbs)");
          // Note the .cif extension instead of .pdb
          const url = 'https://files.rcsb.org/download/1cbs.cif';
          
          // Explicitly set representation type
          addLog("Downloading data...");
          const data = await plugin.builders.data.download({ url });
          addLog("✅ Structure data downloaded");
          
          // Use the correct format for parsing (mmCIF)
          addLog("Parsing trajectory as mmcif...");
          const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
          addLog("✅ Trajectory parsed");
          
          // Apply cartoon representation - more stable than 'default'
          addLog("Applying representation preset...");
          await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
            id: 'preset-structure-representation-cartoon',
            params: {}
          });
          addLog("✅ Structure loaded and rendered");
          
          // Focus camera
          plugin.canvas3d?.resetCamera();
          addLog("Camera reset - rendering should now be visible");
        } catch (mmcifError) {
          addLog(`❌ Error with mmCIF format: ${mmcifError instanceof Error ? mmcifError.message : String(mmcifError)}`);
          
          try {
            // Fall back to PDB format
            addLog("Falling back to PDB format (1cbs)");
            const url = 'https://files.rcsb.org/download/1cbs.pdb';
            
            const data = await plugin.builders.data.download({ url });
            addLog("✅ PDB data downloaded");
            
            const trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb');
            addLog("✅ PDB trajectory parsed");
            
            await plugin.builders.structure.hierarchy.applyPreset(trajectory, {
              id: 'preset-structure-representation-cartoon',
              params: {}
            });
            addLog("✅ PDB structure loaded and rendered");
            
            plugin.canvas3d?.resetCamera();
            addLog("Camera reset - rendering should now be visible");
          } catch (pdbError) {
            throw new Error(`Failed with both mmCIF and PDB formats. PDB error: ${pdbError instanceof Error ? pdbError.message : String(pdbError)}`);
          }
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
