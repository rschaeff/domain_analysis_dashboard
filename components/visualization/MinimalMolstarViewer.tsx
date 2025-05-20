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
 * MinimalMolstarViewer - A React component that renders molecular structures using Molstar
 * with absolutely minimal dependencies and error paths.
 */
export const MinimalMolstarViewer: React.FC<MolstarViewerProps> = ({
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
  const errorOccurredRef = useRef<boolean>(false);
  const loggerRef = useRef<HTMLDivElement | null>(null);
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Safe logging function that doesn't use console methods directly
  const safeLog = (message: string, isError = false) => {
    // Avoid using console methods directly to prevent Next.js interceptions
    if (typeof document !== 'undefined' && loggerRef.current) {
      const logItem = document.createElement('div');
      logItem.textContent = `${isError ? '🔴' : '🔵'} ${message}`;
      logItem.style.color = isError ? 'red' : 'black';
      logItem.style.fontSize = '12px';
      logItem.style.marginBottom = '4px';
      
      // Only keep the last 20 log messages
      if (loggerRef.current.children.length >= 20) {
        loggerRef.current.removeChild(loggerRef.current.firstChild!);
      }
      
      loggerRef.current.appendChild(logItem);
      loggerRef.current.scrollTop = loggerRef.current.scrollHeight;
    }
    
    // Still log to console but avoid direct console.error which Next.js intercepts
    if (isError) {
      // Use a wrapped version to avoid direct console.error calls
      const logToConsole = Function.prototype.bind.call(
        console.log,
        console,
        '%c[ERROR]',
        'color: red; font-weight: bold'
      );
      logToConsole(message);
    } else {
      // Use Function to create a new context that won't be intercepted
      Function.prototype.bind.call(
        console.log,
        console,
        '%c[INFO]',
        'color: blue'
      )(message);
    }
  };
  
  // Safe error handler that doesn't trigger re-renders or loops
  const safeHandleError = (message: string) => {
    if (errorOccurredRef.current) return; // Only handle one error
    
    errorOccurredRef.current = true;
    safeLog(message, true);
    
    // Update state once
    setErrorMessage(message);
    setIsLoading(false);
    
    // Call onError callback once
    if (onError) {
      try {
        onError(message);
      } catch (callbackError) {
        safeLog(`Error in onError callback: ${String(callbackError)}`, true);
      }
    }
  };
  
  // Run once on mount
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current || initAttemptedRef.current) return;
    
    // Mark initialization as attempted
    initAttemptedRef.current = true;
    
    // Create logger element if debug mode
    if (showControls && containerRef.current) {
      const logger = document.createElement('div');
      logger.style.position = 'absolute';
      logger.style.bottom = '10px';
      logger.style.left = '10px';
      logger.style.width = '250px';
      logger.style.maxHeight = '150px';
      logger.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
      logger.style.border = '1px solid #ddd';
      logger.style.padding = '8px';
      logger.style.borderRadius = '4px';
      logger.style.fontSize = '12px';
      logger.style.overflow = 'auto';
      logger.style.zIndex = '1000';
      logger.style.display = showControls ? 'block' : 'none';
      
      containerRef.current.appendChild(logger);
      loggerRef.current = logger;
    }
    
    // Function to dynamically load Molstar with minimal dependencies
    const loadMolstar = async () => {
      try {
        safeLog('Loading Molstar modules...');
        
        // Dynamically import only what we need from Molstar
        const { PluginContext } = await import('molstar/lib/mol-plugin/context');
        const { Asset } = await import('molstar/lib/mol-util/assets');
        
        safeLog('Modules loaded, creating plugin...');
        
        // Create Molstar plugin
        const plugin = new PluginContext();
        
        // Configure plugin options
        plugin.setOptions({
          viewportShowExpand: showControls,
          viewportShowControls: showControls,
          viewportShowSettings: showControls,
          viewportShowSelectionMode: showControls,
          viewportShowAnimation: showControls
        });
        
        // Set up canvas
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('webgl', { preserveDrawingBuffer: true });
        
        if (!ctx) {
          throw new Error('WebGL not supported');
        }
        
        safeLog('Setting up canvas...');
        
        // Calculate proper canvas size
        const updateCanvasSize = () => {
          if (!canvas || !containerRef.current) return;
          
          const width = containerRef.current.clientWidth;
          const height = containerRef.current.clientHeight;
          const pixelRatio = window.devicePixelRatio || 1;
          
          canvas.width = width * pixelRatio;
          canvas.height = height * pixelRatio;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        };
        
        // Update initial canvas size
        updateCanvasSize();
        
        // Configure canvas for Molstar
        if (plugin.canvas3d) {
          safeLog('Configuring canvas3d...');
          
          plugin.canvas3d.setProps({
            canvas,
            webgl: ctx,
            pixelScale: window.devicePixelRatio || 1,
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
        
        // Initialize plugin
        safeLog('Initializing plugin...');
        await plugin.init();
        
        // Store reference
        pluginRef.current = plugin;
        
        // Load structure
        const loadStructure = async () => {
          safeLog(`Loading structure: ${pdbId}`);
          
          try {
            // Clear any existing data
            await plugin.clear();
            
            // Try RCSB PDB first
            safeLog('Trying RCSB PDB...');
            const url = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;
            
            try {
              // Load structure
              const data = await plugin.builders.data.download({ 
                url: Asset.Url(url), 
                isBinary: false 
              });
              
              const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
              
              const structure = await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', {
                structure: { 
                  name: 'model', 
                  params: {} 
                },
                showUnitcell: false,
                representationPreset: 'auto'
              });
              
              safeLog('Structure loaded successfully!');
              
              // Add domain representations if provided
              if (domains.length > 0) {
                safeLog(`Highlighting ${domains.length} domains...`);
                
                // Function to convert hex to RGB
                const hexToRgb = (hex: string) => {
                  const h = hex.replace(/^#/, '');
                  return {
                    r: parseInt(h.length === 3 ? h[0] + h[0] : h.slice(0, 2), 16) / 255,
                    g: parseInt(h.length === 3 ? h[1] + h[1] : h.slice(2, 4), 16) / 255,
                    b: parseInt(h.length === 3 ? h[2] + h[2] : h.slice(4, 6), 16) / 255
                  };
                };
                
                // Clear existing representations
                await plugin.builders.structure.representation.clearAll();
                
                // Add base representation
                await plugin.builders.structure.representation.addRepresentation(structure.structures[0], {
                  type: 'cartoon',
                  color: 'chain-id',
                  opacity: 0.5
                });
                
                // Add domain representations
                for (const domain of domains) {
                  const color = hexToRgb(domain.color);
                  
                  safeLog(`Adding representation for domain: ${domain.label || domain.id}`);
                  
                  // Create selection for domain residues
                  const expression: any = {
                    residueTest: (residue: any) => {
                      const seqNumber = residue.seqNumber.value;
                      return seqNumber >= domain.start && seqNumber <= domain.end;
                    }
                  };
                  
                  // Add chain filter if specified
                  if (domain.chainId) {
                    expression.chainTest = (chain: any) => {
                      return chain.authAsymId === domain.chainId;
                    };
                  }
                  
                  // Add representation
                  await plugin.builders.structure.representation.addRepresentation(
                    structure.structures[0],
                    {
                      type: 'cartoon',
                      color: 'uniform',
                      colorParams: { value: color },
                      opacity: 1.0
                    },
                    {
                      selector: plugin.helpers.structureSelectionBuilder.withPredicate(
                        structure.structures[0],
                        expression
                      )
                    }
                  );
                }
              }
              
              // Focus on specific chain if requested
              if (chainId) {
                safeLog(`Focusing on chain ${chainId}...`);
                
                const expression = {
                  chainTest: (chain: any) => {
                    return chain.authAsymId === chainId;
                  }
                };
                
                const selector = plugin.helpers.structureSelectionBuilder.withPredicate(
                  structure.structures[0],
                  expression
                );
                
                plugin.managers.camera.focusLoci(selector);
              } else {
                // Reset camera to show whole structure
                plugin.canvas3d?.resetCamera();
              }
              
              // Apply camera changes
              plugin.canvas3d?.commit();
              
              // Structure loading successful
              safeLog('Structure displayed successfully');
              setIsLoading(false);
              
              // Call onStructureLoaded callback
              if (onStructureLoaded) {
                try {
                  onStructureLoaded();
                } catch (callbackError) {
                  safeLog(`Error in onStructureLoaded callback: ${String(callbackError)}`, true);
                }
              }
              
            } catch (rcsbError) {
              // RCSB PDB failed, try PDBe as backup
              safeLog('RCSB PDB failed, trying PDBe...', true);
              
              const pdbeUrl = `https://www.ebi.ac.uk/pdbe/static/entry/${pdbId.toLowerCase()}_updated.cif`;
              
              try {
                const data = await plugin.builders.data.download({ 
                  url: Asset.Url(pdbeUrl), 
                  isBinary: false 
                });
                
                const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
                
                const structure = await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default', {
                  structure: { 
                    name: 'model', 
                    params: {} 
                  },
                  showUnitcell: false,
                  representationPreset: 'auto'
                });
                
                safeLog('PDBe structure loaded successfully!');
                
                // Reset camera
                plugin.canvas3d?.resetCamera();
                plugin.canvas3d?.commit();
                
                // Loading successful
                setIsLoading(false);
                
                // Call onStructureLoaded callback
                if (onStructureLoaded) {
                  try {
                    onStructureLoaded();
                  } catch (callbackError) {
                    safeLog(`Error in onStructureLoaded callback: ${String(callbackError)}`, true);
                  }
                }
                
              } catch (pdbeError) {
                // Both sources failed
                throw new Error(`Both RCSB and PDBe sources failed: ${String(pdbeError)}`);
              }
            }
          } catch (loadError) {
            safeHandleError(`Error loading structure: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
          }
        };
        
        // Set up resize handling
        const handleResize = () => {
          updateCanvasSize();
          plugin.canvas3d?.handleResize();
        };
        
        // Add resize listener
        window.addEventListener('resize', handleResize);
        
        // Load the structure
        await loadStructure();
        
        // Set up mouse controls if loading succeeded and not in error state
        if (!errorOccurredRef.current && containerRef.current) {
          safeLog('Setting up mouse controls...');
          
          // Variables for tracking mouse movement
          let isRotating = false;
          let lastX = 0;
          let lastY = 0;
          
          // Mouse wheel handler for zooming
          const handleWheel = (e: WheelEvent) => {
            if (!plugin.canvas3d) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1 : -1;
            plugin.canvas3d.requestCameraZoom(delta);
          };
          
          // Mouse handlers for rotation
          const handleMouseDown = (e: MouseEvent) => {
            if (e.button !== 0) return;
            isRotating = true;
            lastX = e.clientX;
            lastY = e.clientY;
            containerRef.current!.style.cursor = 'grabbing';
          };
          
          const handleMouseMove = (e: MouseEvent) => {
            if (!isRotating || !plugin.canvas3d) return;
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            plugin.canvas3d.requestCameraRotation(deltaX * 0.01, deltaY * 0.01);
            lastX = e.clientX;
            lastY = e.clientY;
          };
          
          const handleMouseUp = () => {
            isRotating = false;
            if (containerRef.current) {
              containerRef.current.style.cursor = '';
            }
          };
          
          // Add event listeners
          containerRef.current.addEventListener('wheel', handleWheel, { passive: false });
          containerRef.current.addEventListener('mousedown', handleMouseDown);
          containerRef.current.addEventListener('mousemove', handleMouseMove);
          containerRef.current.addEventListener('mouseup', handleMouseUp);
          containerRef.current.addEventListener('mouseleave', handleMouseUp);
          
          // Return cleanup for controls
          return () => {
            if (containerRef.current) {
              containerRef.current.removeEventListener('wheel', handleWheel);
              containerRef.current.removeEventListener('mousedown', handleMouseDown);
              containerRef.current.removeEventListener('mousemove', handleMouseMove);
              containerRef.current.removeEventListener('mouseup', handleMouseUp);
              containerRef.current.removeEventListener('mouseleave', handleMouseUp);
            }
            window.removeEventListener('resize', handleResize);
          };
        }
        
        // Return cleanup function
        return () => {
          window.removeEventListener('resize', handleResize);
        };
        
      } catch (initError) {
        // Something went wrong during initialization
        safeHandleError(`Error initializing Molstar: ${initError instanceof Error ? initError.message : String(initError)}`);
      }
    };
    
    // Start loading process
    loadMolstar().catch(err => {
      safeHandleError(`Unhandled error loading Molstar: ${err instanceof Error ? err.message : String(err)}`);
    });
    
    // Cleanup function to remove logger and dispose plugin
    return () => {
      // Remove logger if it exists
      if (loggerRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(loggerRef.current);
          loggerRef.current = null;
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      // Dispose plugin if it exists
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
          pluginRef.current = null;
        } catch (e) {
          // Ignore cleanup errors 
        }
      }
    };
  }, [pdbId]); // Only re-run on PDB ID change
  
  // Render function
  return (
    <div 
      ref={containerRef}
      className={`minimal-molstar-viewer ${className}`}
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
      
      {errorMessage && (
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
            <div>{errorMessage}</div>
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

export default MinimalMolstarViewer;
