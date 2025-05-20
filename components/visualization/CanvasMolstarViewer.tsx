// components/visualization/CanvasMolstarViewer.tsx
'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec'
import { PluginContext } from 'molstar/lib/mol-plugin/context'
// Import color properly
import { ColorNames } from 'molstar/lib/mol-util/color/names'
import 'molstar/build/viewer/molstar.css'

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
  onReady?: (plugin: PluginContext) => void;
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
  const pluginRef = useRef<PluginContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Function to highlight a domain
  const highlightDomain = useCallback(async (domain: Domain, options: MolstarHighlightOptions = {}) => {
    if (!pluginRef.current || !isInitialized) return;

    try {
      const plugin = pluginRef.current;
      const {
        color = '#3b82f6',
        opacity = 1,
        focus = false,
        representationType = 'cartoon'
      } = options;

      // Add representation for domain
      await plugin.builders.structure.representation.addRepresentation({
        repr: {
          type: representationType,
          params: {
            alpha: opacity,
            colorTheme: { name: 'uniform', params: { color: { name: 'color', params: { value: domain.color || color } } } }
          }
        },
        selection: {
          entities: [{ chain_id: chainId, residueNumbers: [{ start: domain.start, end: domain.end }] }]
        }
      });

      // Focus camera on selection if requested
      if (focus) {
        plugin.canvas3d?.camera.focusOnSelection();
      }

      return true;
    } catch (err) {
      console.error('Error highlighting domain:', err);
      return false;
    }
  }, [chainId, isInitialized]);

  // Function to clear all representations
  const clearRepresentations = useCallback(async () => {
    if (!pluginRef.current || !isInitialized) return false;

    try {
      await pluginRef.current.builders.structure.representation.clearSelections();
      return true;
    } catch (err) {
      console.error('Error clearing representations:', err);
      return false;
    }
  }, [isInitialized]);

  // Function to apply representation preset
  const applyRepresentation = useCallback(async (type: string) => {
    if (!pluginRef.current || !isInitialized) return false;

    try {
      await pluginRef.current.representation.preset.applyPreset({
        name: type
      });
      return true;
    } catch (err) {
      console.error('Error applying representation:', err);
      return false;
    }
  }, [isInitialized]);

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
      pluginRef.current.canvas3d?.resetCamera();
      return true;
    } catch (err) {
      console.error('Error resetting camera:', err);
      return false;
    }
  }, [isInitialized]);

  // Expose methods via ref
  const methods = {
    highlightDomain,
    clearRepresentations,
    applyRepresentation,
    takeScreenshot,
    resetCamera,
    getPlugin: () => pluginRef.current
  };

  // Initialize Mol* viewer
  useEffect(() => {
    if (!canvasRef.current || !parentRef.current) return;

    const canvas = canvasRef.current;
    const parent = parentRef.current;

    // Clean up previous instance
    if (pluginRef.current) {
      pluginRef.current.dispose();
      pluginRef.current = null;
      setIsInitialized(false);
    }

    const initMolstar = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setIsInitialized(false);

        // Create plugin with custom spec
        const plugin = new PluginContext(DefaultPluginSpec());
        await plugin.init();

        // Initialize the viewer with our canvas
        if (!plugin.initViewer(canvas, parent)) {
          throw new Error('Failed to initialize Mol* viewer');
        }

        // Store reference to plugin
        pluginRef.current = plugin;

        // Set background color - Fixed implementation
        plugin.canvas3d?.setProps({
          backgroundColor: {
            // Use built-in color names or fallback to white
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
            detectedFileFormat = response.headers.get('X-PDB-Format') || 'pdb';
            console.log(`Detected format from server: ${detectedFileFormat}`);
          } catch (e) {
            console.warn('Could not detect format from server, using default', e);
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

        // Load structure
        const data = await plugin.builders.data.download({ url, isBinary: detectedFileFormat === 'mmtf' }, { state: { isGhost: true } });

        if (!data) {
          throw new Error(`Failed to download structure ${pdbId}`);
        }

        // Parse using detected format
        const trajectory = await plugin.builders.structure.parseTrajectory(data, detectedFileFormat as any);

        // Apply initial representation
        if (initialRepresentation) {
          await plugin.builders.structure.hierarchy.applyPreset(trajectory, initialRepresentation);
        } else {
          await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default');
        }

        // Focus on chain if specified
        if (chainId) {
          await plugin.builders.structure.selection.selectChain({ chain_id: chainId });
        }

        // Mark as initialized
        setIsInitialized(true);

        // Apply domain highlighting if domains are provided
        if (domains.length > 0) {
          await clearRepresentations();
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

    initMolstar();

    // Clean up on unmount
    return () => {
      if (pluginRef.current) {
        try {
          pluginRef.current.dispose();
          pluginRef.current = null;
          setIsInitialized(false);
        } catch (e) {
          console.error('Error disposing Mol* plugin:', e);
        }
      }
    };
  }, [pdbId, chainId, useLocalRepository, format, initialRepresentation, backgroundColor, domains, onReady, onError, highlightDomain, clearRepresentations]);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="text-red-500 bg-white p-4 rounded shadow">
            {error}
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
