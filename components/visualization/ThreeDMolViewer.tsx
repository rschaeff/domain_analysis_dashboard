'use client'

import React, { useEffect, useRef, useState } from 'react';

// Domain type definition
export interface Domain {
  id: string;
  chainId: string;
  start: number;
  end: number;
  color: string;
  label?: string;
  classification?: {
    t_group?: string;
    h_group?: string;
    x_group?: string;
    a_group?: string;
  };
}

// Viewer props
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
    // Only run in browser environment
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Reset state for new PDB ID
    setIsLoading(true);
    setErrorMessage(null);

    // Dynamically import 3DMol.js
    const init3DMol = async () => {
      try {
        // Import 3DMol dynamically to avoid SSR issues
        const $3Dmol = await import('3dmol');

        // Clean up previous viewer if it exists
        if (viewerRef.current) {
          try {
            viewerRef.current.removeAllModels();
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

        // Load structure from PDB using Promise pattern
        try {
          const model = await $3Dmol.download(`pdb:${pdbId}`, viewer, {});

          if (!model) {
            throw new Error('Failed to load model');
          }

          // Set base style for all atoms
          viewer.setStyle({}, { cartoon: { color: 'gray', opacity: 0.5 } });

          // Focus on specific chain if requested
          if (chainId) {
            viewer.setStyle({chain: chainId}, {
              cartoon: {
                color: 'gray',
                opacity: 0.8
              }
            });
          }

          // Add domain representations - OUTSIDE the chainId condition
          if (domains.length > 0) {
            for (const domain of domains) {
              try {
                // Check that the domain range is valid
                if (domain.start > domain.end) {
                  console.log(`Invalid domain range: ${domain.start}-${domain.end}`);
                  continue;
                }

                // Create a safe selection object for this domain
                const selection = {
                  chain: domain.chainId,
                  resi: domain.start.toString() + "-" + domain.end.toString()
                };

                // Set the style for this domain
                viewer.setStyle(selection, {
                  cartoon: {
                    color: domain.color,
                    opacity: 1.0
                  }
                });

                // Add label if present and controls are shown
                if (showControls && domain.label) {
                  try {
                    viewer.addLabel(domain.label, {
                      position: "centered",
                      backgroundColor: domain.color,
                      fontColor: "#ffffff",
                      fontSize: 12,
                      alignment: "center",
                      inFront: true,
                      sel: selection
                    });
                  } catch (labelError) {
                    console.log('Label creation error:', labelError);
                  }
                }
              } catch (domainError) {
                console.log(`Error applying domain ${domain.id}:`, domainError);
              }
            }
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
        } catch (loadError) {
          handleError(`Error loading or rendering structure: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
        }
      } catch (error) {
        handleError(`Error initializing 3DMol.js: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    // Start initialization
    init3DMol();

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
  }, [pdbId, chainId, domains, backgroundColor, showControls, onStructureLoaded, onError]);

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
                const dataUrl = viewerRef.current.pngURI();
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
