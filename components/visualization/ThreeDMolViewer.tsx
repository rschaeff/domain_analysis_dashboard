'use client'

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

// Updated Domain interface
export interface Domain {
  id: string;
  chainId: string;
  // Keep original properties for backward compatibility
  start: number;
  end: number;
  // Add PDB-specific fields
  pdb_start?: string;
  pdb_end?: string;
  pdb_range?: string;  // This can handle discontinuous domains (e.g., "1-100,150-200")
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

const ThreeDMolViewer = forwardRef<any, ThreeDMolViewerProps>(({
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
}, ref) => {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const lastAppliedDomainsRef = useRef<Domain[]>([]);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debug function
  const debugLog = (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[3DMol] ${message}`, data || '');
    }
  };

  // Check if a domain selection exists in the structure
    // Enhanced checkSelectionExists
    const checkSelectionExists = (viewer: any, selection: any): boolean => {
      if (!viewer) return false;

      try {
        // For discontinuous domains, check each segment separately
        if (selection.resi && selection.resi.includes(',')) {
          const segments = selection.resi.split(',');
          let totalAtoms = 0;

          for (const segment of segments) {
            const segmentSelection = { ...selection, resi: segment };
            const atoms = viewer.selectedAtoms(segmentSelection);
            totalAtoms += atoms?.length || 0;
            debugLog(`Selection segment ${segment} has ${atoms?.length || 0} atoms`);
          }

          return totalAtoms > 0;
        } else {
          // Regular continuous domain
          const atoms = viewer.selectedAtoms(selection);
          const exists = atoms && atoms.length > 0;
          debugLog(`Selection ${JSON.stringify(selection)} has ${atoms?.length || 0} atoms`);
          return exists;
        }
      } catch (err) {
        debugLog('Error checking selection:', err);
        return false;
      }
    };
  // Expose the viewer methods via ref
  useImperativeHandle(ref, () => ({
    current: {
      viewerRef: viewerRef,
      reset: () => {
        if (viewerRef.current) {
          try {
            // Apply the original domain styling
            applyDomainStyling(viewerRef.current);
            viewerRef.current.zoomTo();
            viewerRef.current.render();
          } catch (error) {
            debugLog('Error in reset:', error);
          }
        }
      },
      exportImage: () => {
        if (viewerRef.current) {
          return viewerRef.current.pngURI();
        }
        return null;
      },
      highlightDomain: (domainIndex: number) => {
        if (!viewerRef.current || domains.length <= domainIndex) return;

        const domain = domains[domainIndex];
        try {
          debugLog(`Highlighting domain: ${domain.id}, range: ${domain.pdb_range}`);

          // Create a selection to check if this range exists in the structure
            // In highlightDomain function
            const selection = {
              chain: domain.chainId || chainId || 'A',
              resi: domain.pdb_range || `${domain.start}-${domain.end}`
            };

          // Check if this selection has any atoms in the structure
          const selectionExists = checkSelectionExists(viewerRef.current, selection);

          if (!selectionExists) {
            debugLog('Domain selection appears invalid - no atoms found in this range');

            // Don't clear anything - just alert the user of the issue
            if (typeof window !== 'undefined') {
              const warningMsg = `Warning: No atoms found in range ${domain.start}-${domain.end} for domain ${domain.id}. This may be due to PDB numbering differences.`;
              debugLog(warningMsg);

              // Reset to original view to ensure something is visible
              applyDomainStyling(viewerRef.current);
              viewerRef.current.zoomTo();
              viewerRef.current.render();
              return;
            }
          }

          // Lower opacity of everything first
          viewerRef.current.setStyle({}, { cartoon: { color: 'gray', opacity: 0.4 } });

          // Highlight the specific chain
          if (chainId) {
            viewerRef.current.setStyle({chain: chainId}, {
              cartoon: {
                color: 'gray',
                opacity: 0.7
              }
            });
          }

          // Highlight the specific domain with full opacity
          viewerRef.current.setStyle(selection, {
            cartoon: {
              color: domain.color,
              opacity: 1.0
            }
          });

          // Zoom to the domain if it exists
          if (selectionExists) {
            viewerRef.current.zoomTo(selection);
          }

          viewerRef.current.render();
        } catch (error) {
          debugLog('Error highlighting domain:', error);

          // Recovery: restore original styling
          try {
            applyDomainStyling(viewerRef.current);
            viewerRef.current.zoomTo();
            viewerRef.current.render();
          } catch (recoveryError) {
            debugLog('Failed to recover from highlighting error:', recoveryError);
          }
        }
      }
    }
  }));

  // Safe error handler
  const handleError = (message: string) => {
    debugLog(`Error: ${message}`);
    setErrorMessage(message);
    setIsLoading(false);
    if (onError) {
      try {
        onError(message);
      } catch (callbackError) {
        debugLog('Error in onError callback:', callbackError);
      }
    }
  };

  const isDiscontinuousDomain = (range: string): boolean => {
    return range?.includes(',') || false;
  }

  // Apply the domain styling
  const applyDomainStyling = (viewer: any) => {
    if (!viewer) return;

    debugLog(`Applying styling for ${domains.length} domains`);
    debugLog('Domain ranges:', domains.map(d => `${d.id}: ${d.start}-${d.end} (${d.chainId || chainId || 'A'})`));
    if (domain.pdb_range) {
      debugLog(`Using PDB range: ${domain.pdb_range} instead of sequence range: ${domain.start}-${domain.end}`);
    }

    // And in the styling logic
    if (domain.pdb_range && isDiscontinuousDomain(domain.pdb_range)) {
      debugLog(`Domain ${domain.id} is discontinuous: ${domain.pdb_range}`);
      // Potentially add special handling for discontinuous domains
      // Such as different coloring or labeling
    }
    // Cache the domains we're applying styling for
    lastAppliedDomainsRef.current = [...domains];

    // Set base style for all atoms with reduced opacity
    viewer.setStyle({}, { cartoon: { color: 'lightgray', opacity: 0.4 } });

    // Highlight specific chain if provided
    if (chainId) {
      debugLog(`Setting style for chain: ${chainId}`);
      viewer.setStyle({chain: chainId}, {
        cartoon: {
          color: 'gray',
          opacity: 0.7
        }
      });
    }

    // Apply styling for each domain
    if (domains.length > 0) {
      domains.forEach((domain, index) => {
        try {
          // Validate domain range
          if (domain.start > domain.end || domain.start <= 0) {
            debugLog(`Invalid domain range: ${domain.start}-${domain.end}`, domain);
            return;
          }

          // Ensure chain ID is valid
          const domainChainId = domain.chainId || chainId || 'A';

          // Create selection for this domain
            const selection = {
              chain: domainChainId,
              resi: domain.pdb_range || `${domain.start}-${domain.end}`
            };

          // Check if selection exists
          const selectionExists = checkSelectionExists(viewer, selection);
          if (!selectionExists) {
            debugLog(`Warning: Domain ${domain.id} (${domain.pdb_range}) may not match PDB numbering`);
            // Continue anyway to apply styling - it won't break anything
          }

          debugLog(`Setting style for domain ${index}:`, selection);

          // Apply style with full opacity for the domain
          viewer.setStyle(selection, {
            cartoon: {
              color: domain.color || `hsl(${index * 137.5 % 360}, 70%, 50%)`,
              opacity: 1.0
            }
          });

          // Add label if requested
          if (showControls && domain.label) {
            try {
              viewer.addLabel(domain.label, {
                position: { resi: Math.floor((domain.start + domain.end) / 2), chain: domainChainId },
                backgroundColor: domain.color || `hsl(${index * 137.5 % 360}, 70%, 50%)`,
                fontColor: "#ffffff",
                fontSize: 12,
                alignment: "center",
                inFront: true
              });
            } catch (labelError) {
              debugLog(`Label creation error for domain ${index}:`, labelError);
            }
          }
        } catch (domainError) {
          debugLog(`Error applying domain ${domain.id}:`, domainError);
        }
      });
    }

    // Final render
    viewer.render();
  };

  // Initialize and load structure
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === 'undefined' || !containerRef.current) return;

    // Reset state for new PDB ID
    setIsLoading(true);
    setErrorMessage(null);
    loadedRef.current = false;
    lastAppliedDomainsRef.current = [];

    // Dynamically import 3DMol.js
    const init3DMol = async () => {
      try {
        // Import 3DMol dynamically to avoid SSR issues
        const $3Dmol = await import('3dmol');
        debugLog('3DMol library loaded');

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
          backgroundColor: backgroundColor || 'white',
          id: containerRef.current.id
        };

        debugLog('Creating 3DMol viewer with config:', config);
        const viewer = $3Dmol.createViewer(containerRef.current, config);
        viewerRef.current = viewer;

        // Load structure from PDB
        debugLog(`Loading PDB ID: ${pdbId}`);
        try {
          // First try the standard PDB URL
          const pdbUrl = `pdb:${pdbId}`;
          $3Dmol.download(pdbUrl, viewer, {}, function(model) {
            if (!model) {
              handleError(`Failed to load model: ${pdbId}`);
              return;
            }

            debugLog('PDB model loaded successfully');

            // Apply domain styling
            applyDomainStyling(viewer);

            // Zoom to fit the model
            viewer.zoomTo();

            // Update loading state
            setIsLoading(false);
            loadedRef.current = true;

            // Call onStructureLoaded callback
            if (onStructureLoaded) {
              try {
                onStructureLoaded();
              } catch (callbackError) {
                debugLog('Error in onStructureLoaded callback:', callbackError);
              }
            }
          });
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
  }, [pdbId, backgroundColor]);

  // Update domain styling when domains or chainId change
  useEffect(() => {
    if (viewerRef.current && loadedRef.current) {
      // Check if domains actually changed
      const prevDomains = lastAppliedDomainsRef.current;
      const domainsChanged = domains.length !== prevDomains.length ||
        domains.some((d, i) => {
          return !prevDomains[i] ||
            d.start !== prevDomains[i].start ||
            d.end !== prevDomains[i].end ||
            d.chainId !== prevDomains[i].chainId;
        });

      if (domainsChanged || chainId !== lastAppliedDomainsRef.current[0]?.chainId) {
        debugLog('Domain or chain info changed, updating styling');
        applyDomainStyling(viewerRef.current);
      }
    }
  }, [domains, chainId, showControls]);

  return (
    <div
      ref={containerRef}
      id={`3dmol-viewer-${pdbId}-${Date.now()}`} // Unique ID to prevent conflicts
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
          left: '10px',
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
});

ThreeDMolViewer.displayName = 'ThreeDMolViewer';

export default ThreeDMolViewer;
