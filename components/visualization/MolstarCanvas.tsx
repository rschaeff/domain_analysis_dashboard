'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react';

// Define domain type
export interface Domain {
  id: string;
  chainId: string;
  start: number;
  end: number;
  color: string;
  label?: string;
  // Optional classification data
  classification?: {
    t_group?: string;
    h_group?: string;
    x_group?: string;
    a_group?: string;
  };
}

// Viewer props
interface MolstarCanvasProps {
  pdbId: string;
  chainId?: string; 
  domains?: Domain[];
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  backgroundColor?: string;
  onStructureLoaded?: () => void;
  onError?: (error: string) => void;
  showLoading?: boolean;
  showControls?: boolean;
}

/**
 * MolstarCanvas - A React component that renders molecular structures using Molstar
 * without relying on Molstar's React integration.
 */
export const MolstarCanvas: React.FC<MolstarCanvasProps> = ({
  pdbId,
  chainId,
  domains = [],
  width = '100%',
  height = '400px',
  className = '',
  style = {},
  backgroundColor = '#ffffff',
  onStructureLoaded,
  onError,
  showLoading = true,
  showControls = false
}) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pluginRef = useRef<any>(null);
  const structureRef = useRef<any>(null);
  const domainsRef = useRef<Domain[]>(domains);
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Update domains ref when domains prop changes
  useEffect(() => {
    domainsRef.current = domains;
    
    // If plugin exists and structure is loaded, update domain visualization
    if (pluginRef.current && structureRef.current && !isLoading) {
      highlightDomains(pluginRef.current, domains)
        .catch(err => {
          console.error('Error updating domains:', err);
          addLog(`Error updating domains: ${err instanceof Error ? err.message : String(err)}`);
        });
    }
  }, [domains, isLoading]);
  
  // Add a log entry
  const addLog = useCallback((message: string) => {
    console.log(`[MolstarCanvas] ${message}`);
    setLogs(prev => [...prev, message]);
  }, []);
  
  // Handle error
  const handleError = useCallback((errorMessage: string) => {
    console.error(`[MolstarCanvas] ${errorMessage}`);
    setError(errorMessage);
    if (onError) onError(errorMessage);
  }, [onError]);
  
  // Helper function to get hexadecimal color components
  const hexToRgb = useCallback((hex: string) => {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Handle shorthand hex (e.g., #FFF)
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    // Convert to RGB in 0-1 range for Molstar
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    return { r, g, b };
  }, []);
  
  // Parse backgroundColor
  const bgColor = useCallback(() => {
    const rgb = hexToRgb(backgroundColor);
    return { r: rgb.r, g: rgb.g, b: rgb.b, a: 1.0 };
  }, [backgroundColor, hexToRgb]);
  
  // Function to highlight domains
  const highlightDomains = useCallback(async (plugin: any, domains: Domain[]) => {
    if (!plugin || domains.length === 0) return;
    
    try {
      addLog(`Highlighting ${domains.length} domains...`);
      
      // First, clear existing representations
      await plugin.builders.structure.representation.clearAll();
      
      // Get the current structure
      const structure = structureRef.current;
      if (!structure) {
        addLog('No structure available to highlight domains');
        return;
      }
      
      // Add base representation with reduced opacity
      await plugin.builders.structure.representation.addRepresentation(structure, {
        type: 'cartoon',
        color: 'chain-id',
        size: 'uniform',
        sizeParams: { value: 0.5 },
        opacity: 0.3
      });
      
      // Highlight each domain
      for (const domain of domains) {
        // Create selection query for the domain residues
        const query = {
          residueTest: (residue: any) => {
            const seqNumber = residue.seqNumber.value;
            return seqNumber >= domain.start && seqNumber <= domain.end;
          }
        };
        
        // If chain is specified, add it to the query
        if (domain.chainId) {
          Object.assign(query, {
            chainTest: (chain: any) => {
              return chain.authAsymId === domain.chainId;
            }
          });
        }
        
        const color = hexToRgb(domain.color);
        
        // Add cartoon representation for the domain
        await plugin.builders.structure.representation.addRepresentation(structure, {
          type: 'cartoon',
          color: 'uniform',
          colorParams: { value: color },
          size: 'uniform',
          sizeParams: { value: 0.6 }
        }, { 
          selector: plugin.helpers.structureSelectionBuilder.withPredicate(structure, query) 
        });
      }
      
      // Make sure changes are applied
      plugin.canvas3d?.commit();
      
      addLog('Domains highlighted successfully');
    } catch (error) {
      console.error('Error highlighting domains:', error);
      throw error;
    }
  }, [addLog, hexToRgb]);
  
  // Function to load PDB structure
  const loadStructure = useCallback(async (plugin: any, pdbId: string, optional_chainId?: string) => {
    try {
      addLog(`Loading structure: ${pdbId}${optional_chainId ? ` (chain ${optional_chainId})` : ''}`);
      
      // Clear any existing data
      await plugin.clear();
      
      // Construct URL for fetching structure (try RCSB PDB first)
      const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
      
      // Use data transaction for atomic operations
      const structure = await plugin.dataTransaction(async () => {
        try {
          // Download the data
          const asset = await plugin.builders.data.download({ url: { url, label: pdbId }, isBinary: false });
          
          // Parse trajectory
          const trajectory = await plugin.builders.structure.parseTrajectory(asset, 'mmcif');
          
          // Create structure
          const model = await plugin.builders.structure.createModel(trajectory);
          const structure = await plugin.builders.structure.createStructure(model);
          
          // Add base representation
          await plugin.builders.structure.representation.addRepresentation(structure, {
            type: 'cartoon',
            color: 'chain-id'
          });
          
          return structure;
        } catch (e) {
          // If RCSB fails, try PDBe
          addLog('RCSB download failed, trying PDBe...');
          
          const pdbeUrl = `https://www.ebi.ac.uk/pdbe/static/entry/${pdbId.toLowerCase()}_updated.cif`;
          const asset = await plugin.builders.data.download({ url: { url: pdbeUrl, label: pdbId }, isBinary: false });
          
          // Parse trajectory
          const trajectory = await plugin.builders.structure.parseTrajectory(asset, 'mmcif');
          
          // Create structure
          const model = await plugin.builders.structure.createModel(trajectory);
          const structure = await plugin.builders.structure.createStructure(model);
          
          // Add base representation
          await plugin.builders.structure.representation.addRepresentation(structure, {
            type: 'cartoon',
            color: 'chain-id'
          });
          
          return structure;
        }
      });
      
      // Store structure reference
      structureRef.current = structure;
      
      // Focus on the structure or specific chain
      if (optional_chainId) {
        // Focus on specific chain
        const selection = {
          key: `chain-${optional_chainId}`,
          query: plugin.helpers.structureSelectionQueries.chainIdStartsWith(optional_chainId),
          name: `Chain ${optional_chainId}`
        };
        
        const sel = plugin.helpers.structureSelectionFromQuery(structure, selection.query);
        
        if (sel.elements.length > 0) {
          plugin.managers.camera.focusLoci(sel);
        } else {
          addLog(`Chain ${optional_chainId} not found in structure`);
        }
      } else {
        // Focus on entire structure
        plugin.canvas3d?.resetCamera();
      }
      
      plugin.canvas3d?.commit();
      
      addLog('Structure loaded successfully');
      
      // Notify parent component
      if (onStructureLoaded) onStructureLoaded();
      
      return structure;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      handleError(`Error loading structure: ${errorMessage}`);
      throw error;
    }
  }, [addLog, handleError]);
  
  // Initialize Molstar
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    
    // Create visual logger component
    let logContainerEl: HTMLDivElement | null = null;
    
    if (showControls) {
      logContainerEl = document.createElement('div');
      logContainerEl.className = 'molstar-log';
      logContainerEl.style.position = 'absolute';
      logContainerEl.style.bottom = '10px';
      logContainerEl.style.left = '10px';
      logContainerEl.style.color = 'white';
      logContainerEl.style.backgroundColor = 'rgba(0,0,0,0.6)';
      logContainerEl.style.padding = '5px';
      logContainerEl.style.borderRadius = '3px';
      logContainerEl.style.fontSize = '12px';
      logContainerEl.style.maxWidth = '80%';
      logContainerEl.style.maxHeight = '100px';
      logContainerEl.style.overflow = 'auto';
      logContainerEl.style.zIndex = '1000';
      containerRef.current.appendChild(logContainerEl);
      
      // Update log display when logs change
      const updateLogDisplay = () => {
        if (logContainerEl) {
          logContainerEl.innerHTML = logs.map(log => `<div>${log}</div>`).join('');
          logContainerEl.scrollTop = logContainerEl.scrollHeight;
        }
      };
      
      // Create MutationObserver to watch for changes to logs
      const observer = new MutationObserver(() => {
        updateLogDisplay();
      });
      
      // Update logs when component re-renders
      updateLogDisplay();
    }
    
    const initMolstar = async () => {
      try {
        setIsLoading(true);
        addLog('Initializing Molstar...');
        
        // Dynamically import Molstar modules
        const { PluginContext } = await import('molstar/lib/mol-plugin/context');
        const { PluginConfig } = await import('molstar/lib/mol-plugin/config');
        
        // Create plugin instance
        const plugin = new PluginContext();
        
        // Configure plugin options
        plugin.setOptions({
          viewportShowExpand: showControls,
          viewportShowControls: showControls,
          viewportShowSettings: showControls,
          viewportShowSelectionMode: showControls,
          viewportShowAnimation: showControls
        });
        
        // Initialize canvas3d early
        const canvas = canvasRef.current;
        const canvas3d = plugin.canvas3d;
        
        if (canvas && canvas3d) {
          const ctx = canvas.getContext('webgl', { preserveDrawingBuffer: true });
          
          if (!ctx) {
            throw new Error('Could not create WebGL context');
          }
          
          // Set up canvas3d
          await canvas3d.setProps({
            canvas,
            webgl: ctx,
            pixelScale: window.devicePixelRatio,
            pickingAlphaThreshold: 0.5,
            transparency: {
              alphaBlend: true,
              multiSample: true
            },
            renderer: {
              backgroundColor: bgColor()
            }
          });
        }
        
        // Initialize the plugin
        await plugin.init();
        
        // Store plugin reference
        pluginRef.current = plugin;
        
        // Load structure
        await loadStructure(plugin, pdbId, chainId);
        
        // Highlight domains if provided
        if (domains.length > 0) {
          await highlightDomains(plugin, domains);
        }
        
        setIsLoading(false);
      } catch (initError) {
        const errorMessage = initError instanceof Error ? initError.message : String(initError);
        handleError(`Error initializing Molstar: ${errorMessage}`);
        setIsLoading(false);
      }
    };
    
    // Setup resize handler
    const handleResize = () => {
      if (canvasRef.current && pluginRef.current?.canvas3d) {
        const width = containerRef.current?.clientWidth || 300;
        const height = containerRef.current?.clientHeight || 200;
        
        canvasRef.current.width = width * window.devicePixelRatio;
        canvasRef.current.height = height * window.devicePixelRatio;
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;
        
        // Update canvas in Molstar
        pluginRef.current.canvas3d.handleResize();
      }
    };
    
    // Start initialization
    initMolstar();
    
    // Initial sizing
    handleResize();
    
    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      // Remove resize listener
      window.removeEventListener('resize', handleResize);
      
      // Remove log container if it exists
      if (logContainerEl && containerRef.current?.contains(logContainerEl)) {
        containerRef.current.removeChild(logContainerEl);
      }
      
      // Dispose plugin
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
          pluginRef.current = null;
          structureRef.current = null;
        } catch (err) {
          console.error('Error disposing Molstar plugin:', err);
        }
      }
    };
  }, [pdbId, chainId, addLog, handleError, loadStructure, highlightDomains, bgColor, domains, showControls, logs]);
  
  // Add camera controls
  useEffect(() => {
    if (!containerRef.current || !pluginRef.current || isLoading) return;
    
    // Add rotation controls
    const plugin = pluginRef.current;
    
    // Handle mouse wheel for zooming
    const handleWheel = (e: WheelEvent) => {
      if (!plugin.canvas3d) return;
      
      // Prevent default behavior (page scrolling)
      e.preventDefault();
      
      // Calculate zoom direction
      const delta = e.deltaY > 0 ? 1 : -1;
      
      // Apply zoom
      plugin.canvas3d.requestCameraZoom(delta);
    };
    
    // Variables for tracking mouse movement for rotation
    let isRotating = false;
    let lastX = 0;
    let lastY = 0;
    
    // Handle mouse down for rotation
    const handleMouseDown = (e: MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      
      isRotating = true;
      lastX = e.clientX;
      lastY = e.clientY;
      
      // Change cursor
      document.body.style.cursor = 'grabbing';
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    };
    
    // Handle mouse move for rotation
    const handleMouseMove = (e: MouseEvent) => {
      if (!isRotating || !plugin.canvas3d) return;
      
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;
      
      // Apply rotation (adjust sensitivity as needed)
      plugin.canvas3d.requestCameraRotation(deltaX * 0.01, deltaY * 0.01);
      
      lastX = e.clientX;
      lastY = e.clientY;
    };
    
    // Handle mouse up to end rotation
    const handleMouseUp = () => {
      isRotating = false;
      
      // Reset cursor
      document.body.style.cursor = '';
      if (containerRef.current) containerRef.current.style.cursor = '';
    };
    
    // Add event listeners
    const element = containerRef.current;
    element.addEventListener('wheel', handleWheel, { passive: false });
    element.addEventListener('mousedown', handleMouseDown);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseup', handleMouseUp);
    element.addEventListener('mouseleave', handleMouseUp);
    
    // Cleanup
    return () => {
      element.removeEventListener('wheel', handleWheel);
      element.removeEventListener('mousedown', handleMouseDown);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseup', handleMouseUp);
      element.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isLoading]);
  
  return (
    <div 
      ref={containerRef}
      className={`molstar-canvas ${className}`}
      style={{ 
        position: 'relative',
        width, 
        height,
        ...style
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
      
      {showLoading && isLoading && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          zIndex: 10
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              border: '4px solid rgba(0, 0, 0, 0.1)',
              borderTopColor: '#3498db',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              animation: 'molstarSpin 1s linear infinite'
            }} />
            <div>Loading structure...</div>
            
            <style jsx>{`
              @keyframes molstarSpin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      )}
      
      {error && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          color: '#e74c3c',
          zIndex: 20,
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '80%',
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}
      
      {showControls && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10,
          display: 'flex',
          gap: '5px'
        }}>
          <button
            onClick={() => {
              if (pluginRef.current?.canvas3d) {
                pluginRef.current.canvas3d.resetCamera();
                pluginRef.current.canvas3d.commit();
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Reset View
          </button>
          <button
            onClick={() => {
              if (pluginRef.current?.canvas3d) {
                // Take screenshot
                const canvas = pluginRef.current.canvas3d.canvas.element;
                if (canvas) {
                  const dataUrl = canvas.toDataURL('image/png');
                  
                  // Create download link
                  const link = document.createElement('a');
                  link.href = dataUrl;
                  link.download = `${pdbId}${chainId ? '_' + chainId : ''}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '5px 10px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Screenshot
          </button>
        </div>
      )}
    </div>
  );
};

export default MolstarCanvas;
