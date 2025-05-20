/**
 * MolstarViewer - Complete Molstar molecular structure viewer
 * 
 * This component provides a complete Molstar viewer with structure loading,
 * controls, and error handling. It's a high-level component that combines
 * the context provider, hooks, and canvas.
 */
import React, { useState, useEffect, useRef } from 'react';
import { MolstarProvider } from './MolstarContext';
import { useMolstar } from './MolstarContext';
import { MolstarCanvas } from './MolstarCanvas';
import { useStructureLoader, StructureInfo } from './useStructureLoader';
import { useDomainViewer, Domain } from './useDomainViewer';

// Types
export interface MolstarViewerProps {
  // Structure info
  pdbId: string;
  chainId?: string;
  assemblyId?: string;
  format?: 'mmcif' | 'pdb' | 'mmtf' | 'auto';
  useLocalRepository?: boolean;
  
  // Display options
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
  className?: string;
  showControls?: boolean;
  showLogger?: boolean;
  transparentBackground?: boolean;
  safeMode?: boolean;
  
  // Domain visualization
  domains?: Domain[];
  colorByClassification?: boolean;
  
  // Events
  onReady?: (plugin: any) => void;
  onError?: (message: string) => void;
}

/**
 * Internal viewer component that uses the hooks
 */
const ViewerContent: React.FC<Omit<MolstarViewerProps, 'style' | 'safeMode'>> = ({
  pdbId,
  chainId,
  assemblyId,
  format = 'auto',
  useLocalRepository = true,
  width,
  height,
  className,
  showControls = false,
  showLogger = false,
  transparentBackground = false,
  domains = [],
  colorByClassification = true,
  onReady,
  onError
}) => {
  // Get context and hooks
  const { plugin, isBusy, isInitialized, error: contextError, logs, takeScreenshot } = useMolstar();
  const { 
    loadStructure, 
    isLoading, 
    hasStructure, 
    error: structureError,
    focusChain
  } = useStructureLoader();
  
  const {
    highlightMultipleDomains,
    clearDomainHighlights,
    activeDomains,
    error: domainError
  } = useDomainViewer();
  
  // Track loaded structure
  const [isStructureReady, setIsStructureReady] = useState(false);
  const lastPdbIdRef = useRef(pdbId);
  const lastChainIdRef = useRef(chainId);
  
  // Load structure when initialized
  useEffect(() => {
    if (!plugin || !isInitialized) return;
    
    // Check if we need to load a new structure (PDB ID or chain ID changed)
    const needsLoad = 
      !isStructureReady || 
      pdbId !== lastPdbIdRef.current || 
      chainId !== lastChainIdRef.current;
    
    if (needsLoad) {
      // Update refs
      lastPdbIdRef.current = pdbId;
      lastChainIdRef.current = chainId;
      
      // Reset ready state
      setIsStructureReady(false);
      
      // Define structure info
      const structureInfo: StructureInfo = {
        pdbId,
        chainId,
        assemblyId,
        format,
        useLocalRepository,
        representationStyle: 'cartoon'
      };
      
      // Load structure
      loadStructure(structureInfo)
        .then(success => {
          if (success) {
            setIsStructureReady(true);
            if (onReady && plugin) onReady(plugin);
          }
        })
        .catch(err => {
          if (onError) onError(err instanceof Error ? err.message : String(err));
        });
    }
  }, [
    plugin, isInitialized, pdbId, chainId, assemblyId, 
    format, useLocalRepository, loadStructure, isStructureReady,
    onReady, onError
  ]);
  
  // Process domains when structure is ready
  useEffect(() => {
    if (!isStructureReady || domains.length === 0) return;
    
    // Clear existing domains first
    clearDomainHighlights().then(() => {
      // Highlight the new domains
      highlightMultipleDomains(domains, chainId);
    });
  }, [
    isStructureReady, 
    domains, 
    chainId, 
    clearDomainHighlights, 
    highlightMultipleDomains
  ]);
  
  // Handle errors
  useEffect(() => {
    const error = contextError || structureError || domainError;
    if (error && onError) {
      onError(error);
    }
  }, [contextError, structureError, domainError, onError]);
  
  // Render the viewer
  return (
    <div className={`molstar-viewer ${className || ''}`} style={{ width, height, position: 'relative' }}>
      {/* The actual canvas */}
      <MolstarCanvas 
        width="100%" 
        height="100%" 
        transparentBackground={transparentBackground}
        showControls={showControls}
      />
      
      {/* Status/error overlay */}
      {(!isInitialized || (!hasStructure && !isLoading)) && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(245, 245, 245, 0.9)',
          zIndex: 20
        }}>
          <div style={{ textAlign: 'center', maxWidth: '80%' }}>
            {!isInitialized ? (
              <div>Initializing Molstar...</div>
            ) : (contextError || structureError || domainError) ? (
              <div style={{ color: 'red' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Error:</div>
                <div>{contextError || structureError || domainError}</div>
              </div>
            ) : (
              <div>No structure loaded</div>
            )}
          </div>
        </div>
      )}
      
      {/* Screenshot button */}
      {isStructureReady && (
        <button
          onClick={() => {
            const dataUrl = takeScreenshot();
            if (dataUrl) {
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = `${pdbId}${chainId ? '_' + chainId : ''}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          }}
          className="absolute top-2 right-2 z-30 px-2 py-1 bg-white shadow-md rounded text-xs opacity-80 hover:opacity-100"
          style={{ display: isStructureReady ? 'block' : 'none' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </button>
      )}
      
      {/* Logger */}
      {showLogger && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '150px',
          overflow: 'auto',
          fontSize: '12px',
          fontFamily: 'monospace',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#d0d0d0',
          padding: '4px 8px',
          zIndex: 30
        }}>
          {logs.map((log, index) => (
            <div 
              key={index}
              style={{ 
                color: log.level === 'error' ? '#ff6b6b' : 
                      log.level === 'warn' ? '#ffd166' : '#d0d0d0'
              }}
            >
              [{log.timestamp}] {log.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Complete Molstar Viewer with integrated provider
 */
export const MolstarViewer: React.FC<MolstarViewerProps> = ({
  style,
  safeMode = false,
  ...props
}) => {
  return (
    <div style={{ position: 'relative', ...style }}>
      <MolstarProvider safeMode={safeMode}>
        <ViewerContent {...props} />
      </MolstarProvider>
    </div>
  );
};
