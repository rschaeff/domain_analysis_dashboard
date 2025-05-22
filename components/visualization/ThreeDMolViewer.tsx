'use client'

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

// Updated Domain interface with PDB-specific fields
export interface Domain {
  id: string;
  chainId: string;
  start: number;
  end: number;
  color: string;
  label?: string;
  // PDB-specific fields for accurate structure selection
  pdb_range?: string;
  pdb_start?: string;
  pdb_end?: string;
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

  // Helper to check if a domain is discontinuous
  const isDiscontinuousDomain = (range: string): boolean => {
    return range?.includes(',') || false;
  };

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

  // Get available residue numbers in the structure for debugging
  const getAvailableResidues = (viewer: any, chain: string): number[] => {
    if (!viewer) return [];
    try {
      const allAtoms = viewer.selectedAtoms({chain: chain});
      const residueSet = new Set<number>();

      // Extract unique residue numbers from structure
      allAtoms.forEach((atom: any) => {
        residueSet.add(parseInt(atom.resi));
      });

      return Array.from(residueSet).sort((a,b) => a-b);
    } catch (e) {
      debugLog('Error fetching available residues:', e);
      return [];
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

            // Focus on the chain if specified
            if (chainId) {
              viewerRef.current.zoomTo({chain: chainId});
            } else {
              viewerRef.current.zoomTo();
            }

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
          debugLog(`Highlighting domain: ${domain.id}, range: ${domain.start}-${domain.end}`);

          // Use pdb_range if available, otherwise fallback to sequence range
          const resiValue = domain.pdb_range || `${domain.start}-${domain.end}`;
          debugLog(`Using resi value: ${resiValue} for domain ${domain.id}`);

          // Create a selection to check if this range exists in the structure
          const selection = {
            chain: domain.chainId || chainId || 'A',
            resi: resiValue
          };

          // Check if this selection has any atoms in the structure
          const selectionExists = checkSelectionExists(viewerRef.current, selection);

          if (!selectionExists) {
            debugLog('Domain selection appears invalid - no atoms found in this range');

            // Show available residues for debugging
            const availableResidues = getAvailableResidues(viewerRef.current, domain.chainId || chainId || 'A');

            if (availableResidues.length > 0) {
              debugLog('First 10 available residues:', availableResidues.slice(0, 10));
              debugLog('Last 10 available residues:', availableResidues.slice(-10));
            }

            // Don't clear anything - just alert the user of the issue
            if (typeof window !== 'undefined') {
              const warningMsg = `Warning: No atoms found in range ${resiValue} for domain ${domain.id}. This may be due to PDB numbering differences.`;
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

  // Apply the domain styling with improved range handling
  const applyDomainStyling = (viewer: any) => {
    if (!viewer) return;

    debugLog(`Applying styling for ${domains.length} domains`);

    // Log each domain's range information for debugging
    domains.forEach((domain, index) => {
      debugLog(`Domain ${index} (${domain.id}):`, {
        start: domain.start,
        end: domain.end,
        pdb_range: domain.pdb_range,
        pdb_start: domain.pdb_start,
        pdb_end: domain.pdb_end,
        color: domain.color
      });
    });

    // Cache the domains we're applying styling for
    lastAppliedDomainsRef.current = [...domains];

    if (domains.length > 0) {
      // When we have domains, style them individually and hide everything else

      // First, hide all atoms with very low opacity
      viewer.setStyle({}, { cartoon: { color: 'lightgray', opacity: 0.1 } });

      // Apply styling for each domain with bright colors
      domains.forEach((domain, index) => {
        try {
          // Determine the best range to use for selection
          let resiValue;
          let start = domain.start;
          let end = domain.end;

          // Validate basic range
          if (!start || !end || isNaN(start) || isNaN(end) || start <= 0 || end <= 0) {
            debugLog(`Invalid sequence range for domain ${domain.id}: start=${start}, end=${end}`);

            // Try to use PDB range if sequence range is invalid
            if (domain.pdb_range) {
              resiValue = domain.pdb_range;
              debugLog(`Using pdb_range fallback: ${resiValue}`);
            } else if (domain.pdb_start && domain.pdb_end) {
              resiValue = `${domain.pdb_start}-${domain.pdb_end}`;
              debugLog(`Using pdb_start/pdb_end fallback: ${resiValue}`);
            } else {
              debugLog(`No valid range found for domain ${domain.id}, skipping`);
              return;
            }
          } else {
            // Use PDB range if available, otherwise use sequence range
            if (domain.pdb_range) {
              resiValue = domain.pdb_range;
              debugLog(`Using pdb_range: ${resiValue} for domain ${domain.id}`);
            } else if (domain.pdb_start && domain.pdb_end) {
              resiValue = `${domain.pdb_start}-${domain.pdb_end}`;
              debugLog(`Using pdb_start/pdb_end: ${resiValue} for domain ${domain.id}`);
            } else {
              resiValue = `${start}-${end}`;
              debugLog(`Using sequence range: ${resiValue} for domain ${domain.id}`);
            }
          }

          // Ensure chain ID is valid
          const domainChainId = domain.chainId || chainId || 'A';

          const selection = {
            chain: domainChainId,
            resi: resiValue
          };

          // Check if selection exists
          const selectionExists = checkSelectionExists(viewer, selection);

          if (!selectionExists) {
            debugLog(`Warning: Domain ${domain.id} range ${resiValue} not found in structure`);

            // Show available residues for debugging
            const availableResidues = getAvailableResidues(viewer, domainChainId);
            if (availableResidues.length > 0) {
              debugLog('Available residues range:', `${availableResidues[0]} to ${availableResidues[availableResidues.length-1]}`);

              // Try to map sequence range to available residues if possible
              if (!domain.pdb_range && start && end && availableResidues.length > 0) {
                const mappedStart = availableResidues[0] + (start - 1);
                const mappedEnd = availableResidues[0] + (end - 1);
                if (mappedEnd <= availableResidues[availableResidues.length-1]) {
                  const mappedSelection = {
                    chain: domainChainId,
                    resi: `${mappedStart}-${mappedEnd}`
                  };
                  const mappedExists = checkSelectionExists(viewer, mappedSelection);
                  if (mappedExists) {
                    debugLog(`Mapped range ${start}-${end} to ${mappedStart}-${mappedEnd} successfully`);
                    resiValue = `${mappedStart}-${mappedEnd}`;
                    selection.resi = resiValue;
                  }
                }
              }
            }
          }

          // Use hex colors instead of HSL - 3DMol seems to prefer these
          const domainColor = domain.color || DOMAIN_COLORS[index % DOMAIN_COLORS.length];
          debugLog(`Setting style for domain ${index} with color ${domainColor}:`, selection);

          // Apply bright domain color with full opacity
          const styleObj = {
            cartoon: {
              color: domainColor,
              opacity: 1.0
            }
          };

          viewer.setStyle(selection, styleObj);
          debugLog(`Applied style:`, styleObj);

          // Verify the style was applied by checking what 3DMol thinks is set
          try {
            const atoms = viewer.selectedAtoms(selection);
            debugLog(`Domain ${index} has ${atoms.length} atoms after styling`);
          } catch (e) {
            debugLog(`Error checking styled atoms:`, e);
          }

          // Add label if requested
          if (showControls && domain.label) {
            try {
              viewer.addLabel(domain.label, {
                position: { resi: Math.floor((start + end) / 2), chain: domainChainId },
                backgroundColor: domainColor,
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
    } else {
      // No domains - just show the chain in a neutral color
      if (chainId) {
        debugLog(`No domains, showing chain ${chainId} in neutral color`);
        viewer.setStyle({}, { cartoon: { color: 'lightgray', opacity: 0.4 } });
        viewer.setStyle({chain: chainId}, {
          cartoon: {
            color: 'gray',
            opacity: 0.8
          }
        });
      }
    }

    // Force a render after styling
    debugLog('Forcing render after styling');
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

        // Load structure from PDB through local API proxy
        debugLog(`Loading PDB ID: ${pdbId}`);
        try {
          // Use local API proxy instead of direct PDB access
          const pdbUrl = `/api/pdb/${pdbId}`;

          // Use URL fetch instead of pdb: protocol
          $3Dmol.download(pdbUrl, viewer, {}, function(model) {
            if (!model) {
              handleError(`Failed to load model: ${pdbId}`);
              return;
            }

            debugLog('PDB model loaded successfully');

            // Apply domain styling first
            applyDomainStyling(viewer);

            // Focus on the specific chain if provided, otherwise zoom to all
            if (chainId) {
              debugLog(`Focusing on chain: ${chainId}`);
              try {
                // Zoom to the specific chain
                viewer.zoomTo({chain: chainId});
              } catch (e) {
                debugLog('Error zooming to chain, using default zoom:', e);
                viewer.zoomTo();
              }
            } else {
              // Zoom to fit the entire model
              viewer.zoomTo();
            }

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
            d.pdb_range !== prevDomains[i].pdb_range ||
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
