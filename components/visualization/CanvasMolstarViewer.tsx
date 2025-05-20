// components/visualization/CanvasMolstarViewer.tsx
'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

// Lazy import Mol* to ensure it only loads on the client
const molstarImports = {
  DefaultPluginSpec: null as any,
  PluginContext: null as any,
  ColorNames: null as any,
  Structure: null as any,
};

// Load Mol* dynamically only on the client side
let isMolstarLoaded = false;
async function loadMolstar() {
  if (typeof window === 'undefined') return false;
  if (isMolstarLoaded) return true;

  try {
    // Dynamically import on client only
    molstarImports.DefaultPluginSpec = (await import('molstar/lib/mol-plugin/spec')).DefaultPluginSpec;
    molstarImports.PluginContext = (await import('molstar/lib/mol-plugin/context')).PluginContext;
    molstarImports.ColorNames = (await import('molstar/lib/mol-util/color/names')).ColorNames;
    molstarImports.Structure = (await import('molstar/lib/mol-model/structure')).Structure;

    // Load CSS
    await import('molstar/build/viewer/molstar.css');

    isMolstarLoaded = true;
    return true;
  } catch (error) {
    console.error('Failed to load Mol* dependencies:', error);
    return false;
  }
}

export type FormatType = 'auto' | 'pdb' | 'mmcif' | 'mmtf';

export interface Domain {
  id: string;
  start: number;
  end: number;
  color?: string;
  label?: string;
}

export interface MolstarHighlightOptions {
  color?: string;
  opacity?: number;
  focus?: boolean;
  representationType?: 'cartoon' | 'ball-and-stick' | 'surface' | 'spacefill';
}

interface CanvasMolstarViewerProps {
  pdbId: string;
  chainId?: string;
  height?: string | number;
  width?: string | number;
  className?: string;
  onReady?: (plugin: any) => void;
  onError?: (error: string) => void;
  useLocalRepository?: boolean;
  format?: FormatType;
  initialRepresentation?: 'cartoon' | 'ball-and-stick' | 'surface' | 'spacefill';
  domains?: Domain[];
  backgroundColor?: string;
}

export function CanvasMolstarViewer({
  pdbId,
  chainId,
  height = '400px',
  width = '100%',
  className = '',
  onReady,
  onError,
  useLocalRepository = true,
  format = 'auto',
  initialRepresentation = 'cartoon',
  domains = [],
  backgroundColor = 'white'
}: CanvasMolstarViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const pluginRef = useRef<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [structure, setStructure] = useState<any | null>(null);
  const [loadAttempted, setLoadAttempted] = useState<boolean>(false);
  const [isClient, setIsClient] = useState(false);
  const [isMolstarReady, setIsMolstarReady] = useState(false);

  // First effect to check if we're on the client and load Mol* dependencies
  useEffect(() => {
    setIsClient(true);

    // Load Mol* dependencies
    loadMolstar().then(success => {
      if (success) {
        setIsMolstarReady(true);
      } else {
        setError("Failed to load Mol* visualization libraries");
        setIsLoading(false);
        if (onError) onError("Failed to load Mol* visualization libraries");
      }
    });
  }, [onError]);

  // Check for WebGL support
  const checkWebGLSupport = useCallback(() => {
    if (typeof window === 'undefined') return { supported: false, error: 'Not in browser environment' };

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!gl) {
        return { supported: false, error: 'WebGL is not supported by your browser' };
      }

      // Check for specific extensions/capabilities needed by Mol*
      const maxVertexTextures = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);

      if (maxVertexTextures < 8) {
        return {
          supported: false,
          error: `Your graphics hardware supports only ${maxVertexTextures} vertex textures, but Mol* requires at least 8`
        };
      }

      return { supported: true };
    } catch (e) {
      return { supported: false, error: e instanceof Error ? e.message : String(e) };
    }
  }, []);

  // Function to highlight a domain with query expression
  const highlightDomain = useCallback(async (domain: Domain, options: MolstarHighlightOptions = {}) => {
    if (!pluginRef.current || !isInitialized || !structure) return false;

    try {
      const plugin = pluginRef.current;
      const {
        color = '#3b82f6',
        opacity = 1,
        focus = false,
        representationType = 'cartoon'
      } = options;

      // Build the query for residue selection
      let query = '';
      if (chainId) {
        // Try both auth_asym_id and label_asym_id for maximum compatibility
        query = `(auth_asym_id="${chainId}" OR label_asym_id="${chainId}") AND `;
      }
      query += `resi>${domain.start - 1} AND resi<${domain.end + 1}`;

      // Add representation for domain
      const component = await plugin.builders.structure.representation.addRepresentation(structure, {
        type: representationType,
        color: domain.color || color,
        opacity
      }, { query });

      // Focus camera if requested
      if (focus && component) {
        plugin.managers.camera.focusLoci(component.representations[0].getLoci());
      }

      return true;
    } catch (err) {
      console.error('Error highlighting domain:', err);
      return false;
    }
  }, [chainId, isInitialized, structure]);

  // Function to clear all representations
  const clearRepresentations = useCallback(async () => {
    if (!pluginRef.current || !isInitialized) return false;

    try {
      // Clear all existing representations
      const plugin = pluginRef.current;
      const state = plugin.state.data;

      const components = state.select(q => q.ofType('structure-representation-3d'));
      if (components.length === 0) return true;

      for (const c of components) {
        await state.updateTree({ state, removes: [c.transform.ref] });
      }
      return true;
    } catch (err) {
      console.error('Error clearing representations:', err);
      return false;
    }
  }, [isInitialized]);

  // Function to apply representation preset
  const applyRepresentation = useCallback(async (type: string) => {
    if (!pluginRef.current || !isInitialized || !structure) return false;

    try {
      await clearRepresentations();

      // Apply new representation
      const plugin = pluginRef.current;

      if (type === 'cartoon') {
        await plugin.builders.structure.representation.addRepresentation(structure, { type: 'cartoon' });
      } else if (type === 'ball-and-stick') {
        await plugin.builders.structure.representation.addRepresentation(structure, { type: 'ball-and-stick' });
      } else if (type === 'surface') {
        await plugin.builders.structure.representation.addRepresentation(structure, { type: 'molecular-surface' });
      } else if (type === 'spacefill') {
        await plugin.builders.structure.representation.addRepresentation(structure, { type: 'spacefill' });
      }

      return true;
    } catch (err) {
      console.error('Error applying representation:', err);
      return false;
    }
  }, [isInitialized, structure, clearRepresentations]);

  // Function to take screenshot
  const takeScreenshot = useCallback(() => {
    if (!pluginRef.current || !isInitialized) return null;

    try {
      const canvas = pluginRef.current.canvas3d?.canvas.element;
      if (canvas) {
        return canvas.toDataURL('image/png');
      }
      return null;
    } catch (err) {
      console.error('Error taking screenshot:', err);
      return null;
    }
  }, [isInitialized]);

  // Function to reset camera
  const resetCamera = useCallback(() => {
    if (!pluginRef.current || !isInitialized) return false;

    try {
      // Try to reset camera view to show all
      pluginRef.current.managers.camera.reset();
      return true;
    } catch (err) {
      console.error('Error resetting camera:', err);
      return false;
    }
  }, [isInitialized]);

  // Check WebGL support only on client
  useEffect(() => {
    if (!isClient || !isMolstarReady) return;

    const webglSupport = checkWebGLSupport();

    if (!webglSupport.supported) {
      setError(`WebGL compatibility issue: ${webglSupport.error}`);
      setIsLoading(false);
      if (onError) onError(`WebGL compatibility issue: ${webglSupport.error}`);
    }
  }, [isClient, isMolstarReady, checkWebGLSupport, onError]);

  // Initialize Mol* viewer
  useEffect(() => {
    // Only run on client and after Mol* is loaded
    if (!isClient || !isMolstarReady) return;
    if (!canvasRef.current || !parentRef.current) return;
    if (loadAttempted) return; // Prevent multiple load attempts
    if (error) return; // Don't try to initialize if we have a WebGL error

    setLoadAttempted(true);
    const canvas = canvasRef.current;
    const parent = parentRef.current;

    // Clean up previous instance
    if (pluginRef.current) {
      pluginRef.current.dispose();
      pluginRef.current = null;
      setIsInitialized(false);
      setStructure(null);
    }

    // Initialize viewer and load structure
    const initMolstar = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setIsInitialized(false);

        // Create plugin with default spec
        const { DefaultPluginSpec, PluginContext } = molstarImports;
        const plugin = new PluginContext(DefaultPluginSpec());
        await plugin.init();

        // Try to initialize the viewer with proper error handling
        try {
          // Initialize the viewer with our canvas
          if (!plugin.initViewer(canvas, parent)) {
            throw new Error('Failed to initialize Mol* viewer');
          }
        } catch (viewerInitError) {
          console.error('Error initializing viewer:', viewerInitError);
          throw new Error(`WebGL compatibility issue: ${viewerInitError instanceof Error ? viewerInitError.message : String(viewerInitError)}`);
        }

        // Store reference to plugin
        pluginRef.current = plugin;

        // Set background color
        const { ColorNames } = molstarImports;
        plugin.canvas3d?.setProps({
          backgroundColor: {
            color: backgroundColor in ColorNames ? ColorNames[backgroundColor] : ColorNames.white
          }
        });

        // Determine URL based on data source
        let url;
        let detectedFileFormat;

        if (useLocalRepository) {
          // Use local API
          url = `/api/pdb/${pdbId.toLowerCase()}`;

          try {
            // Make a HEAD request to check format
            const response = await fetch(url, { method: 'HEAD' });

            if (!response.ok) {
              throw new Error(`Local PDB server returned ${response.status}`);
            }

            detectedFileFormat = response.headers.get('X-PDB-Format') || 'pdb';
            console.log(`Detected format from server: ${detectedFileFormat}`);
          } catch (e) {
            console.warn('Could not detect format from server, attempting download anyway', e);
            detectedFileFormat = 'pdb';
          }
        } else {
          // Use external source based on format preference
          if (format === 'auto' || format === 'mmcif') {
            url = `https://files.rcsb.org/download/${pdbId}.cif`;
            detectedFileFormat = 'mmcif';
          } else if (format === 'pdb') {
            url = `https://files.rcsb.org/download/${pdbId}.pdb`;
            detectedFileFormat = 'pdb';
          } else if (format === 'mmtf') {
            url = `https://mmtf.rcsb.org/v1.0/full/${pdbId}`;
            detectedFileFormat = 'mmtf';
          } else {
            url = `https://files.rcsb.org/download/${pdbId}.cif`;
            detectedFileFormat = 'mmcif';
          }
        }

        setDetectedFormat(detectedFileFormat);
        console.log(`Loading ${pdbId} from ${url} as ${detectedFileFormat}`);

        // Load structure (following the documentation example)
        const data = await plugin.builders.data.download({
          url,
          isBinary: detectedFileFormat === 'mmtf',
          tryGzip: true
        }, { state: { isGhost: true } });

        if (!data) {
          throw new Error(`Failed to download structure ${pdbId}`);
        }

        // Parse using detected format
        const trajectory = await plugin.builders.structure.parseTrajectory(data, detectedFileFormat as any);

        // Apply representation preset
        const structureObject = await plugin.builders.structure.hierarchy.applyPreset(
          trajectory,
          initialRepresentation === 'cartoon' ? 'default' : initialRepresentation
        );

        // Store the structure for later use
        if (structureObject?.structures?.length > 0) {
          setStructure(structureObject.structures[0]);
        }

        // Focus on chain if specified
        if (chainId && structureObject) {
          try {
            // Create a query expression for the chain
            const components = plugin.managers.structure.hierarchy.current.structures[0].components;
            const chainComponent = components.find(c =>
              c.cell.obj.data.models.some(m =>
                m.chains.some(ch =>
                  ch.authAsymId === chainId || ch.asymId === chainId
                )
              )
            );

            if (chainComponent) {
              // Select the chain
              plugin.managers.structure.hierarchy.selection.selectAll();
              plugin.managers.structure.component.updateRepresentationsTheme({ color: 'chain-id' });
              plugin.managers.camera.focus(components.map(c => c.cell), { durationMs: 250 });
            }
          } catch (chainErr) {
            console.warn('Error focusing on chain, showing whole structure:', chainErr);
            plugin.managers.camera.reset();
          }
        }

        // Mark as initialized
        setIsInitialized(true);

        // Apply domain highlighting if domains are provided
        if (domains.length > 0 && structureObject) {
          // Clear existing representations
          await clearRepresentations();

          // Apply representations for each domain
          for (const domain of domains) {
            await highlightDomain(domain);
          }
        }

        // Notify ready
        setIsLoading(false);
        if (onReady) onReady(plugin);
      } catch (err) {
        console.error('Error initializing Mol*:', err);
        const errorMessage = `Failed to load: ${err instanceof Error ? err.message : String(err)}`;
        setError(errorMessage);
        setIsLoading(false);
        if (onError) onError(errorMessage);
      }
    };

    initMolstar().catch(err => {
      console.error('Unhandled error in initMolstar:', err);
      setError(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
      setIsLoading(false);
      if (onError) onError(`Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
    });

    // Clean up on unmount
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
          pluginRef.current = null;
          setIsInitialized(false);
          setStructure(null);
        } catch (e) {
          console.error('Error disposing Mol* plugin:', e);
        }
      }
    };
  }, [
    pdbId, chainId, useLocalRepository, format, initialRepresentation, backgroundColor,
    domains, onReady, onError, highlightDomain, clearRepresentations, loadAttempted,
    error, checkWebGLSupport, isClient, isMolstarReady
  ]);

  // Reset loadAttempted when key props change
  useEffect(() => {
    setLoadAttempted(false);
    setError(null);
  }, [pdbId, chainId, useLocalRepository]);

  // Server-side render gracefully
  if (!isClient) {
    return (
      <div className={`relative ${className}`} style={{ width, height }}>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-red-500 bg-white p-4 rounded shadow max-w-md">
            <p className="font-bold mb-2">Error:</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div ref={parentRef} className="w-full h-full" style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </div>

      {detectedFormat && !error && !isLoading && (
        <div className="absolute bottom-2 right-2 bg-white/80 text-xs px-2 py-1 rounded">
          Format: {detectedFormat}
        </div>
      )}
    </div>
  );
}
