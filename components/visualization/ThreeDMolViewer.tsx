'use client'

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

// Domain colors with high contrast
const DOMAIN_COLORS = [
  '#FF0000', // Red
  '#0066FF', // Blue
  '#00CC00', // Green
  '#FF6600', // Orange
  '#9900CC', // Purple
  '#00CCCC', // Cyan
  '#CC6600', // Brown
  '#FF99CC', // Pink
  '#666666', // Gray
  '#336699', // Steel Blue
];

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
  const structureInfoRef = useRef<any>(null);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Debug function
  const debugLog = (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[3DMol] ${message}`, data || '');
    }
  };

  // Parse chain mapping from mmCIF data
  const parseChainMapping = (mmcifData: string) => {
    const mapping = new Map<string, string>(); // auth_chain -> asym_id

    try {
      // Look for the _pdbx_poly_seq_scheme block
      const lines = mmcifData.split('\n');
      let inPolySeqScheme = false;
      let headerIndices: { [key: string]: number } = {};

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Start of the block
        if (line.startsWith('_pdbx_poly_seq_scheme.')) {
          inPolySeqScheme = true;
          const field = line.substring('_pdbx_poly_seq_scheme.'.length);
          headerIndices[field] = Object.keys(headerIndices).length;
          continue;
        }

        // End of block (empty line or new section)
        if (inPolySeqScheme && (line === '' || line.startsWith('_') || line.startsWith('#'))) {
          break;
        }

        // Parse data line
        if (inPolySeqScheme && line && !line.startsWith('_') && !line.startsWith('#')) {
          const parts = line.split(/\s+/);

          if (parts.length >= Math.max(headerIndices['asym_id'] || 0, headerIndices['pdb_strand_id'] || 0)) {
            const asymId = parts[headerIndices['asym_id']] || '';
            const authChain = parts[headerIndices['pdb_strand_id']] || '';

            if (asymId && authChain && authChain !== '.') {
              mapping.set(authChain, asymId);
            }
          }
        }
      }

      debugLog('Parsed chain mapping from mmCIF:', Object.fromEntries(mapping));
      return mapping;
    } catch (error) {
      debugLog('Error parsing chain mapping:', error);
      return mapping;
    }
  };

  // Analyze structure to understand residue numbering and available chains
  const analyzeStructure = (viewer: any, targetChain?: string, mmcifData?: string) => {
    try {
      // Get all atoms first to see what chains are available
      const allAtoms = viewer.selectedAtoms({});
      const allChains = [...new Set(allAtoms.map((atom: any) => atom.chain))];

      debugLog(`Available chains in structure: ${allChains.join(', ')}`);

      // Parse chain mapping from mmCIF if available
      let chainMapping = new Map<string, string>();
      if (mmcifData) {
        chainMapping = parseChainMapping(mmcifData);
      }

      // Find the best chain to use
      let actualChain = targetChain;

      if (targetChain && !allChains.includes(targetChain)) {
        debugLog(`Requested chain ${targetChain} not found in structure`);

        // First, try the chain mapping from mmCIF
        if (chainMapping.has(targetChain)) {
          const mappedChain = chainMapping.get(targetChain);
          if (mappedChain && allChains.includes(mappedChain)) {
            actualChain = mappedChain;
            debugLog(`Found mmCIF mapping: ${targetChain} -> ${actualChain}`);
          }
        }

        // If mapping didn't work, try reverse mapping (asym_id -> auth_chain)
        if (actualChain === targetChain) {
          for (const [authChain, asymId] of chainMapping.entries()) {
            if (asymId === targetChain && allChains.includes(authChain)) {
              actualChain = authChain;
              debugLog(`Found reverse mmCIF mapping: ${targetChain} -> ${actualChain}`);
              break;
            }
          }
        }

        // If still no match, fall back to the most protein-like chain
        if (actualChain === targetChain) {
          const chainAnalysis = allChains.map(chain => {
            const atoms = viewer.selectedAtoms({chain});
            const residues = [...new Set(atoms.map((atom: any) => atom.resi).filter(r => r))];
            const caAtoms = atoms.filter((atom: any) => atom.atom === 'CA');

            return {
              chain,
              atomCount: atoms.length,
              residueCount: residues.length,
              caCount: caAtoms.length,
              isProteinLike: caAtoms.length > 50
            };
          });

          // Sort by protein-like properties
          chainAnalysis.sort((a, b) => {
            if (a.isProteinLike !== b.isProteinLike) {
              return a.isProteinLike ? -1 : 1;
            }
            return b.caCount - a.caCount;
          });

          if (chainAnalysis.length > 0) {
            actualChain = chainAnalysis[0].chain;
            debugLog(`Fallback to most protein-like chain: ${actualChain}`);
          }
        }
      }

      if (!actualChain && allChains.length > 0) {
        actualChain = allChains[0];
        debugLog(`Using first available chain: ${actualChain}`);
      }

      if (!actualChain) {
        debugLog('No chains found in structure');
        return null;
      }

      // Analyze the target chain
      const atoms = viewer.selectedAtoms({chain: actualChain});
      if (atoms.length === 0) {
        debugLog(`No atoms found for chain ${actualChain}`);
        return null;
      }

      const residues = new Set<number>();
      atoms.forEach((atom: any) => {
        if (atom.resi) {
          residues.add(parseInt(atom.resi));
        }
      });

      const sortedResidues = Array.from(residues).sort((a, b) => a - b);
      const info = {
        actualChain,
        originalChain: targetChain,
        minResidue: sortedResidues[0],
        maxResidue: sortedResidues[sortedResidues.length - 1],
        totalResidues: sortedResidues.length,
        residueList: sortedResidues,
        allChains
      };

      debugLog(`Structure analysis for chain ${actualChain}:`, info);
      return info;
    } catch (error) {
      debugLog('Error analyzing structure:', error);
      return null;
    }
  };

  // Enhanced coordinate mapping
  const mapSequenceToStructure = (seqStart: number, seqEnd: number, structureInfo: any) => {
    if (!structureInfo) return null;

    // Try direct mapping first (common case)
    if (seqStart >= structureInfo.minResidue && seqEnd <= structureInfo.maxResidue) {
      return `${seqStart}-${seqEnd}`;
    }

    // Try offset mapping (sequence starts from 1, structure might start from different number)
    const offset = structureInfo.minResidue - 1;
    const mappedStart = seqStart + offset;
    const mappedEnd = seqEnd + offset;

    if (mappedStart >= structureInfo.minResidue && mappedEnd <= structureInfo.maxResidue) {
      debugLog(`Mapped sequence ${seqStart}-${seqEnd} to structure ${mappedStart}-${mappedEnd}`);
      return `${mappedStart}-${mappedEnd}`;
    }

    // Try relative mapping (sequence position relative to structure length)
    const seqLength = seqEnd - seqStart + 1;
    const structLength = structureInfo.totalResidues;

    if (seqLength <= structLength) {
      const relativeStart = Math.floor((seqStart - 1) / structLength * structureInfo.totalResidues);
      const relativeEnd = Math.min(relativeStart + seqLength - 1, structureInfo.totalResidues - 1);

      const actualStart = structureInfo.residueList[relativeStart];
      const actualEnd = structureInfo.residueList[relativeEnd];

      if (actualStart && actualEnd) {
        debugLog(`Relative mapping ${seqStart}-${seqEnd} to ${actualStart}-${actualEnd}`);
        return `${actualStart}-${actualEnd}`;
      }
    }

    debugLog(`Could not map sequence range ${seqStart}-${seqEnd} to structure`);
    return null;
  };

  // Check if selection exists with detailed feedback
  const checkSelectionExists = (viewer: any, selection: any): boolean => {
    if (!viewer) return false;

    try {
      const atoms = viewer.selectedAtoms(selection);
      const exists = atoms && atoms.length > 0;
      debugLog(`Selection ${JSON.stringify(selection)} has ${atoms?.length || 0} atoms`);
      return exists;
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

            // Focus on the chain if specified
            const targetChain = structureInfoRef.current?.actualChain || chainId;
            if (targetChain) {
              viewerRef.current.zoomTo({chain: targetChain});
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
        const targetChain = structureInfoRef.current?.actualChain || domain.chainId || chainId || 'A';

        try {
          debugLog(`Highlighting domain: ${domain.id}, range: ${domain.start}-${domain.end}`);

          // Get mapped range
          const mappedRange = getMappedRange(domain);
          if (!mappedRange) {
            debugLog('Could not map domain range for highlighting');
            return;
          }

          const selection = {
            chain: targetChain,
            resi: mappedRange
          };

          // Set background to low opacity
          viewerRef.current.setStyle({}, { cartoon: { color: 'lightgray', opacity: 0.3 } });
          viewerRef.current.setStyle({chain: targetChain}, { cartoon: { color: 'gray', opacity: 0.5 } });

          // Highlight the specific domain
          viewerRef.current.setStyle(selection, {
            cartoon: {
              color: domain.color,
              opacity: 1.0
            }
          });

          // Zoom to the domain
          viewerRef.current.zoomTo(selection);
          viewerRef.current.render();
        } catch (error) {
          debugLog('Error highlighting domain:', error);
          // Recovery: restore original styling
          try {
            applyDomainStyling(viewerRef.current);
            viewerRef.current.render();
          } catch (recoveryError) {
            debugLog('Failed to recover from highlighting error:', recoveryError);
          }
        }
      }
    }
  }));

  // Get mapped range for a domain
  const getMappedRange = (domain: Domain): string | null => {
    // Use PDB range if available
    if (domain.pdb_range) {
      return domain.pdb_range;
    }

    if (domain.pdb_start && domain.pdb_end) {
      return `${domain.pdb_start}-${domain.pdb_end}`;
    }

    // Try to map sequence coordinates to structure
    if (structureInfoRef.current && domain.start && domain.end) {
      return mapSequenceToStructure(domain.start, domain.end, structureInfoRef.current);
    }

    // Fallback to sequence range
    if (domain.start && domain.end) {
      return `${domain.start}-${domain.end}`;
    }

    return null;
  };

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

  // Apply domain styling with improved approach
  const applyDomainStyling = (viewer: any) => {
    if (!viewer) return;

    const targetChain = structureInfoRef.current?.actualChain || chainId || 'A';
    debugLog(`Applying styling for ${domains.length} domains on chain ${targetChain}`);

    // Step 1: Show the entire structure/chain in gray (unclassified regions)
    viewer.setStyle({}, { cartoon: { color: 'lightgray', opacity: 0.4 } });
    viewer.setStyle({chain: targetChain}, {
      cartoon: {
        color: 'gray',
        opacity: 0.8
      }
    });

    // Step 2: Apply domain colors on top of the gray background
    if (domains.length > 0) {
      let successfulDomains = 0;

      domains.forEach((domain, index) => {
        try {
          debugLog(`Processing domain ${index} (${domain.id}):`, {
            start: domain.start,
            end: domain.end,
            pdb_range: domain.pdb_range,
            pdb_start: domain.pdb_start,
            pdb_end: domain.pdb_end,
            color: domain.color
          });

          // Get the best range to use
          const mappedRange = getMappedRange(domain);

          if (!mappedRange) {
            debugLog(`Skipping domain ${domain.id} - no valid range`);
            return;
          }

          const domainChainId = structureInfoRef.current?.actualChain || domain.chainId || targetChain;
          const selection = {
            chain: domainChainId,
            resi: mappedRange
          };

          // Check if this selection exists in the structure
          const selectionExists = checkSelectionExists(viewer, selection);

          if (selectionExists) {
            // Apply domain color
            const domainColor = domain.color || DOMAIN_COLORS[index % DOMAIN_COLORS.length];

            viewer.setStyle(selection, {
              cartoon: {
                color: domainColor,
                opacity: 1.0
              }
            });

            successfulDomains++;
            debugLog(`✓ Styled domain ${domain.id} with range ${mappedRange}`);
          } else {
            debugLog(`⚠ Domain ${domain.id} range ${mappedRange} not found in structure`);
          }

        } catch (domainError) {
          debugLog(`Error processing domain ${domain.id}:`, domainError);
        }
      });

      debugLog(`Successfully styled ${successfulDomains}/${domains.length} domains`);
    }

    // Step 3: Force render
    viewer.render();
    lastAppliedDomainsRef.current = [...domains];
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
    structureInfoRef.current = null;

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

        // Load structure using mmCIF format
        debugLog(`Loading PDB ID: ${pdbId} (mmCIF format)`);

        // Try the local API first (now serves mmCIF)
        const structureUrl = `/api/pdb/${pdbId}`;

        // Load structure with fetch and explicit format
        try {
          const response = await fetch(structureUrl);
          if (response.ok) {
            const structureData = await response.text();

            // Validate mmCIF data
            if (structureData.includes('data_') || structureData.includes('_entry.id')) {
              debugLog('mmCIF structure loaded successfully from local API');

              // Add model with explicit mmCIF format
              const model = viewer.addModel(structureData, 'cif');
              if (model) {
                processLoadedStructure(viewer, structureData);
              } else {
                throw new Error('Failed to parse mmCIF data');
              }
            } else {
              throw new Error('Invalid mmCIF data received');
            }
          } else {
            throw new Error(`API returned ${response.status}: ${response.statusText}`);
          }
        } catch (apiError) {
          debugLog('Local API failed, trying RCSB mmCIF direct:', apiError);

          // Fallback to RCSB direct mmCIF
          const rcsbUrl = `https://files.rcsb.org/download/${pdbId.toLowerCase()}.cif`;

          try {
            const response = await fetch(rcsbUrl);
            if (response.ok) {
              const structureData = await response.text();
              if (structureData.includes('data_') || structureData.includes('_entry.id')) {
                debugLog('mmCIF structure loaded from RCSB direct');
                const model = viewer.addModel(structureData, 'cif');
                if (model) {
                  processLoadedStructure(viewer, structureData);
                } else {
                  throw new Error('Failed to parse mmCIF data from RCSB');
                }
              } else {
                throw new Error('Invalid mmCIF data from RCSB');
              }
            } else {
              throw new Error(`RCSB returned ${response.status}: ${response.statusText}`);
            }
          } catch (rcsbError) {
            handleError(`Failed to load structure ${pdbId} from all sources: ${rcsbError}`);
          }
        }

      } catch (error) {
        handleError(`Error initializing 3DMol.js: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    // Process loaded structure
    const processLoadedStructure = (viewer: any, mmcifData?: string) => {
      try {
        debugLog('Processing loaded mmCIF structure');

        // Analyze the structure to understand residue numbering and find correct chain
        structureInfoRef.current = analyzeStructure(viewer, chainId, mmcifData);

        if (!structureInfoRef.current) {
          throw new Error('Could not analyze structure - no chains found');
        }

        // Apply domain styling
        applyDomainStyling(viewer);

        // Focus on the correct chain
        const targetChain = structureInfoRef.current.actualChain;
        debugLog(`Focusing on chain: ${targetChain}`);

        try {
          viewer.zoomTo({chain: targetChain});
        } catch (e) {
          debugLog('Error zooming to chain, using default zoom:', e);
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
      } catch (processingError) {
        handleError(`Error processing structure: ${processingError instanceof Error ? processingError.message : String(processingError)}`);
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

      if (domainsChanged) {
        debugLog('Domain info changed, updating styling');
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
                const targetChain = structureInfoRef.current?.actualChain || chainId;
                if (targetChain) {
                  viewerRef.current.zoomTo({chain: targetChain});
                } else {
                  viewerRef.current.zoomTo();
                }
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
