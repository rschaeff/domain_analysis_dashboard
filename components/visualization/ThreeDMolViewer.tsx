'use client'

import React, { useEffect, useRef, useState } from 'react';
import * as $3Dmol from '3dmol';

// Interface matching your existing Domain type
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

// Props interface
interface ThreeDMolViewerProps {
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
 * ThreeDMolViewer - A React component for visualizing molecular structures using 3DMol.js
 */
const ThreeDMolViewer: React.FC<ThreeDMolViewerProps> = ({
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
  const viewerRef = useRef<any>(null);
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Safe error handler
  const handleError = (message: string) => {
    setErrorMessage(message);
    setIsLoading(false);
    if (onError) {
      try {
        onError(message);
      } catch (callbackError) {
        console.log('Error in onError callback:', callbackError);
      }
    }
  };

  // Initialize and load structure
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Reset state for new PDB ID
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Clean up previous viewer if it exists
      if (viewerRef.current) {
        try {
          viewerRef.current.removeAllModels();
          // In some versions, we need to call this explicitly
          if (typeof viewerRef.current.destroy === 'function') {
            viewerRef.current.destroy();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
        viewerRef.current = null;
      }

      // Create a new viewer
      const config = {
        backgroundColor: backgroundColor,
        id: containerRef.current.id
      };
      
      const viewer = $3Dmol.createViewer(containerRef.current, config);
      viewerRef.current = viewer;

      // Load structure from PDB
      $3Dmol.download(`pdb:${pdbId}`, viewer, {}, function(model) {
        try {
          // Set base style for all atoms
          viewer.setStyle({}, { cartoon: { color: 'gray', opacity: 0.5 } });
          
          // Focus on specific chain if requested
          if (chainId) {
            viewer.setStyle({chain: chainId}, { cartoon: { color: 'gray', opacity: 0.8 } });
          }
          
          // Add domain representations
          if (domains.length > 0) {
            domains.forEach(domain => {
              viewer.setStyle({
                chain: domain.chainId,
                resi: { gte: domain.start, lte: domain.end }
              }, {
                cartoon: {
                  color: domain.color,
                  opacity: 1.0
                }
              });
              
              // Add label if present and controls are shown
              if (showControls && domain.label) {
                // Get the center of the domain
                const midPoint = Math.floor((domain.start + domain.end) / 2);
                
                // Find a representative atom for the label
                const atoms = viewer.getModel().selectedAtoms({
                  chain: domain.chainId,
                  resi: midPoint
                });
                
                if (atoms.length > 0) {
                  const atom = atoms[0];
                  viewer.addLabel(domain.label, {
                    position: { x: atom.x, y: atom.y, z: atom.z },
                    backgroundColor: domain.color,
                    fontColor: "#ffffff",
                    fontSize: 12,
                    alignment: "center"
                  });
                }
              }
            });
          }
          
          // Zoom to fit the model
          viewer.zoomTo();
          // Render the model
          viewer.render();
          
          // Finished loading
          setIsLoading(false);
          
          // Call onStructureLoaded callback
          if (onStructureLoaded) {
            try {
              onStructureLoaded();
            } catch (callbackError) {
              console.log('Error in onStructureLoaded callback:', callbackError);
            }
          }
        } catch (renderError) {
          handleError(`Error rendering structure: ${renderError instanceof Error ? renderError.message : String(renderError)}`);
        }
      }, (error: any) => {
        // Handle download error
        handleError(`Error loading structure: ${error instanceof Error ? error.message : String(error)}`);
      });
      
      // Set up controls
      if (showControls) {
        // Attach mouse move event for rotation
        containerRef.current.addEventListener('mousedown', (e) => {
          if (e.button === 0) { // Left mouse button
            containerRef.current!.style.cursor = 'grabbing';
          }
        });
        
        containerRef.current.addEventListener('mouseup', () => {
          containerRef.current!.style.cursor = '';
        });
        
        // 3DMol.js handles mouse events internally for rotation
      }
      
    } catch (initError) {
      handleError(`Error initializing 3DMol.js: ${initError instanceof Error ? initError.message : String(initError)}`);
    }
    
    // Cleanup function
    return () => {
      if (viewerRef.current) {
        try {
          viewerRef.current.removeAllModels();
          if (typeof viewerRef.current.destroy === 'function') {
            viewerRef.current.destroy();
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [pdbId, chainId, domains, backgroundColor, showControls]);

  return (
    <div 
      ref={containerRef}
      id={`3dmol-viewer-${pdbId}`}
      className={`three-dmol-viewer ${className}`}
      style={{ 
        position: 'relative',
        width, 
        height,
        ...style
      }}
    >
      {/* Loading indicator */}
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
              animation: 'spin 1s linear infinite'
            }} />
            <div>Loading structure...</div>
            
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      )}
      
      {/* Error message */}
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
      
      {/* Controls */}
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
              if (viewerRef.current) {
                viewerRef.current.zoomTo();
                viewerRef.current.render();
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
              if (viewerRef.current) {
                // Take screenshot - 3DMol has a built-in function
                const dataUrl = viewerRef.current.pngURI();
                
                // Create download link
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `${pdbId}${chainId ? '_' + chainId : ''}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
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

export default ThreeDMolViewer;
