'use client'

import React, { useRef, useEffect, useState } from 'react';

// Domain type definition
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
interface MolstarViewerProps {
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
 * FixedMolstarViewer - A React component that renders molecular structures using Molstar's core API
 * without relying on Molstar's React integration.
 */
export const FixedMolstarViewer: React.FC<MolstarViewerProps> = ({
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
  const initAttemptedRef = useRef<boolean>(false);
  const errorHandledRef = useRef<boolean>(false);
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainState, setDomainState] = useState<Domain[]>(domains);
  
  // Update domain state when domains prop changes
  useEffect(() => {
    setDomainState(domains);
  }, [domains]);
  
  // Handle error safely without triggering re-renders
  const handleError = (errorMessage: string) => {
    // Prevent repeat error handling
    if (errorHandledRef.current) return;
    
    console.error(`[FixedMolstarViewer] ${errorMessage}`);
    
    // Set error state only once
    setError(errorMessage);
    errorHandledRef.current = true;
    
    // Call onError only once
    if (onError) onError(errorMessage);
  };
  
  // Log a message without side effects
  const log = (message: string) => {
    console.log(`[FixedMolstarViewer] ${message}`);
  };
  
  // Function to highlight domains - defined outside the effect to avoid recreation
  const highlightDomains = async (plugin: any, domains: Domain[]) => {
    if (!plugin || domains.length === 0) return;
    
    try {
      log(`Highlighting ${domains.length} domains...`);
      
      // First, clear existing representations
      await plugin.builders.structure.representation.clearAll();
      
      // Get the current structure hierarchy
      const structure = plugin.managers.structure.hierarchy.current.structures[0];
      if (!structure) {
        log('No structure available to highlight domains');
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
      
      // Helper function to convert hex to RGB
      const hexToRgb = (hex: string) => {
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
      };
      
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
      
      log('Domains highlighted successfully');
    } catch (error) {
      log(`Error highlighting domains: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Update domains when they change
  useEffect(() => {
    if (!pluginRef.current || isLoading) return;
    
    // Highlight domains
    highlightDomains(pluginRef.current, domainState)
      .catch(err => {
        log(`Error updating domains: ${err instanceof Error ? err.message : String(err)}`);
      });
  }, [domainState, isLoading]);
  
  // Initialize Molstar
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    
    // If we've already attempted initialization or handled an error, don't try again
    if (initAttemptedRef.current) return;
    
    // Mark that we've attempted initialization
    initAttemptedRef.current = true;
    
    // Function to safely initialize using vanilla JS methods
    const initMolstar = async () => {
      // Create a WebGL canvas
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('webgl', { preserveDrawingBuffer: true });
      
      if (!ctx) {
        handleError('Could not create WebGL context');
        return;
      }
      
      // Define the canvas size
      const updateCanvasSize = () => {
        if (!canvas) return;
        
        const container = containerRef.current;
        if (!container) return;
        
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // Set size with pixel ratio for high DPI displays
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      };
      
      // Update canvas size
      updateCanvasSize();
      
      try {
        // Dynamically import Molstar modules to avoid SSR issues
        const { PluginContext } = await import('molstar/lib/mol-plugin/context');
        const { Asset } = await import('molstar/lib/mol-util/assets');
        
        // Create a Molstar plugin
        const plugin = new PluginContext();
        
        // Configure the canvas
        if (plugin.canvas3d) {
          plugin.canvas3d.setProps({
            canvas,
            webgl: ctx,
            pixelScale: window.devicePixelRatio,
            pickingAlphaThreshold: 0.5,
            transparency: {
              alphaBlend: true,
              multiSample: true
            },
            renderer: {
              backgroundColor: {
                r: parseInt(backgroundColor.slice(1, 3), 16) / 255,
                g: parseInt(backgroundColor.slice(3, 5), 16) / 255,
                b: parseInt(backgroundColor.slice(5, 7), 16) / 255,
                a: 1
              }
            }
          });
        }
        
        // Initialize the plugin
        await plugin.init();
        
        // Save the plugin reference
        pluginRef.current = plugin;
        
        // Set up resize listener
        const handleResize = () => {
          updateCanvasSize();
          if (plugin.canvas3d) {
            plugin.canvas3d.handleResize();
          }
        };
        
        window.addEventListener('resize', handleResize);
        
        // Load the structure
        try {
          // Clear any existing data
          await plugin.clear();
          
          // Construct URL for fetching structure
          const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
          
          // Load the structure
          const data = await plugin.builders.data.download({ 
            url: Asset.Url(url), 
            isBinary: false 
          });
          
          const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
          
          // Apply representation
          const hierarchy = await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', {
            structure: { 
              name: 'model', 
              params: {} 
            },
            showUnitcell: false,
            representationPreset: 'auto'
          });
          
          // Focus camera on structure
          plugin.canvas3d?.resetCamera();
          
          // Highlight domains if provided
          if (domainState.length > 0) {
            await highlightDomains(plugin, domainState);
          }
          
          // Focus on specific chain if specified
          if (chainId && hierarchy.structures.length > 0) {
            const structure = hierarchy.structures[0];
            const selection = {
              chainTest: (chain: any) => {
                return chain.authAsymId === chainId;
              }
            };
            
            const sel = plugin.helpers.structureSelectionBuilder.withPredicate(structure, selection);
            plugin.managers.camera.focusLoci(sel);
          }
          
          // Notify that loading is complete
          setIsLoading(false);
          if (onStructureLoaded) onStructureLoaded();
          
        } catch (loadError) {
          // Try PDBe as fallback
          try {
            const pdbeUrl = `https://www.ebi.ac.uk/pdbe/static/entry/${pdbId.toLowerCase()}_updated.cif`;
            const data = await plugin.builders.data.download({ 
              url: Asset.Url(pdbeUrl), 
              isBinary: false 
            });
            
            const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
            
            // Apply representation
            const hierarchy = await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', {
              structure: { 
                name: 'model', 
                params: {} 
              },
              showUnitcell: false,
              representationPreset: 'auto'
            });
            
            // Focus camera on structure
            plugin.canvas3d?.resetCamera();
            
            // Highlight domains if provided
            if (domainState.length > 0) {
              await highlightDomains(plugin, domainState);
            }
            
            // Focus on specific chain if specified
            if (chainId && hierarchy.structures.length > 0) {
              const structure = hierarchy.structures[0];
              const selection = {
                chainTest: (chain: any) => {
                  return chain.authAsymId === chainId;
                }
              };
              
              const sel = plugin.helpers.structureSelectionBuilder.withPredicate(structure, selection);
              plugin.managers.camera.focusLoci(sel);
            }
            
            // Notify that loading is complete
            setIsLoading(false);
            if (onStructureLoaded) onStructureLoaded();
            
          } catch (fallbackError) {
            handleError(`Error loading structure: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
            setIsLoading(false);
          }
        }
        
        // Return cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
          if (pluginRef.current) {
            pluginRef.current.dispose();
            pluginRef.current = null;
          }
        };
      } catch (error) {
        handleError(`Error initializing Molstar: ${error instanceof Error ? error.message : String(error)}`);
        setIsLoading(false);
      }
    };
    
    // Start initialization
    initMolstar();
    
  }, [pdbId, chainId, backgroundColor, onStructureLoaded]);
  
  // Add simple camera controls - only when plugin is initialized and not loading
  useEffect(() => {
    if (!containerRef.current || !pluginRef.current || isLoading) return;
    
    const plugin = pluginRef.current;
    
    // Variables for tracking mouse movement for rotation
    let isRotating = false;
    let lastX = 0;
    let lastY = 0;
    
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
  
  // Render the component
  return (
    <div 
      ref={containerRef}
      className={`fixed-molstar-viewer ${className}`}
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

export default FixedMolstarViewer;
