/**
 * MolstarContext - Core provider for Molstar integration with React
 * 
 * This context provider initializes the Molstar plugin and provides
 * access to its functionality through React's context API. It properly
 * manages the plugin lifecycle and synchronizes Molstar's state with React.
 */
'use client'

import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { renderReact18 } from 'molstar/lib/mol-plugin-ui/react18';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { PluginUIComponent } from 'molstar/lib/mol-plugin-ui/base';
import { useBehavior } from 'molstar/lib/mol-plugin-ui/hooks/use-behavior';
import { PluginState } from 'molstar/lib/mol-plugin/state';

// Types
export interface MolstarContextType {
  plugin: PluginContext | null;
  isBusy: boolean;
  isInitialized: boolean;
  error: string | null;
  addLog: (message: string, level?: 'info' | 'warn' | 'error') => void;
  logs: { message: string; level: string; timestamp: string }[];
  takeScreenshot: () => string | null;
}

// Create context with default values
export const MolstarContext = createContext<MolstarContextType>({
  plugin: null,
  isBusy: false,
  isInitialized: false,
  error: null,
  addLog: () => {},
  logs: [],
  takeScreenshot: () => null
});

// Provider props
export interface MolstarProviderProps {
  children: React.ReactNode;
  initializeOnMount?: boolean;
  safeMode?: boolean;
  defaultSpec?: Partial<DefaultPluginUISpec>;
}

/**
 * MolstarProvider - Core provider component that initializes and manages the Molstar plugin
 * 
 * @param children - React children
 * @param initializeOnMount - Whether to initialize the plugin when the component mounts (default: true)
 * @param safeMode - Whether to use safe mode with manual initialization steps (default: false)
 * @param defaultSpec - Custom plugin specification options
 */
export const MolstarProvider: React.FC<MolstarProviderProps> = ({ 
  children, 
  initializeOnMount = true,
  safeMode = false,
  defaultSpec = {}
}) => {
  // Refs
  const pluginRef = useRef<PluginContext | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [logs, setLogs] = useState<{ message: string; level: string; timestamp: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [manualInitState, setManualInitState] = useState<'idle' | 'ready' | 'initializing' | 'error'>(
    safeMode ? 'idle' : 'ready'
  );
  
  // Add log entry
  const addLog = useCallback((message: string, level: 'info' | 'warn' | 'error' = 'info') => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    
    // Log to console with appropriate level
    if (level === 'info') console.log(`[Molstar] ${message}`);
    if (level === 'warn') console.warn(`[Molstar] ${message}`);
    if (level === 'error') console.error(`[Molstar] ${message}`);
    
    // Update logs state
    setLogs(prev => [
      ...prev,
      { message, level, timestamp }
    ]);
  }, []);

  // Take screenshot of current view
  const takeScreenshot = useCallback((): string | null => {
    if (!pluginRef.current || !isInitialized) {
      addLog('Cannot take screenshot: plugin not initialized', 'warn');
      return null;
    }
    
    try {
      const canvas = pluginRef.current.canvas3d?.canvas.element;
      if (canvas) {
        return canvas.toDataURL('image/png');
      }
      return null;
    } catch (err) {
      addLog(`Error taking screenshot: ${err instanceof Error ? err.message : String(err)}`, 'error');
      return null;
    }
  }, [isInitialized, addLog]);

  // Initialize Molstar plugin
  const initializePlugin = useCallback(async () => {
    if (pluginRef.current || !containerRef.current) return;
    
    if (safeMode) {
      setManualInitState('initializing');
    }
    
    try {
      addLog('Initializing Molstar plugin...');
      
      // Create plugin spec with default values and overrides
      const spec = {
        ...DefaultPluginUISpec(),
        ...defaultSpec,
        layout: {
          ...DefaultPluginUISpec().layout,
          ...defaultSpec.layout,
          initial: {
            isExpanded: false,
            showControls: false,
            controlsDisplay: 'reactive',
            regionState: {
              bottom: 'collapsed',
              left: 'collapsed',
              right: 'collapsed',
              top: 'collapsed'
            },
          },
        },
        components: {
          ...DefaultPluginUISpec().components,
          ...defaultSpec.components,
          controls: { 
            ...DefaultPluginUISpec().components?.controls,
            ...defaultSpec.components?.controls,
            top: { movable: true },
            left: { movable: true },
            right: { movable: true },
            bottom: { movable: true }
          },
        },
        canvas3d: {
          ...DefaultPluginUISpec().canvas3d,
          ...defaultSpec.canvas3d,
          renderer: {
            ...DefaultPluginUISpec().canvas3d?.renderer,
            ...defaultSpec.canvas3d?.renderer,
            backgroundColor: 0xFFFFFF
          }
        }
      };
      
      // Create plugin
      const plugin = await createPluginUI({
        target: containerRef.current,
        spec,
        render: renderReact18
      });
      
      // Store reference
      pluginRef.current = plugin;
      
      // Update state
      addLog('Molstar plugin initialized successfully');
      setIsInitialized(true);
      setError(null);
      
      if (safeMode) {
        setManualInitState('ready');
      }
      
      return plugin;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      addLog(`Failed to initialize Molstar: ${errorMessage}`, 'error');
      setError(`Initialization error: ${errorMessage}`);
      
      if (safeMode) {
        setManualInitState('error');
      }
      
      return null;
    }
  }, [addLog, defaultSpec, safeMode]);
  
  // Get isBusy state from plugin
  const isBusy = pluginRef.current ? useBehavior(pluginRef.current.behaviors.state.isBusy) : false;
  
  // Initialize on mount if requested
  useEffect(() => {
    if (initializeOnMount && !safeMode) {
      initializePlugin();
    }
    
    // Cleanup function
    return () => {
      if (pluginRef.current) {
        // Safely dispose of plugin on unmount
        try {
          addLog('Disposing Molstar plugin');
          pluginRef.current.dispose();
          pluginRef.current = null;
        } catch (e) {
          console.error('Error disposing Molstar plugin:', e);
        }
      }
    };
  }, [initializeOnMount, initializePlugin, addLog, safeMode]);
  
  // Context value
  const contextValue = {
    plugin: pluginRef.current,
    isBusy,
    isInitialized,
    error,
    addLog,
    logs,
    takeScreenshot
  };
  
  // Render in safe mode if requested
  if (safeMode) {
    return (
      <MolstarContext.Provider value={contextValue}>
        {/* Hidden container for plugin initialization */}
        <div ref={containerRef} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} />
        
        {manualInitState === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
            <button
              onClick={initializePlugin}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Initialize Molstar Viewer
            </button>
          </div>
        )}
        
        {manualInitState === 'initializing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
            <div className="flex items-center">
              <svg className="animate-spin h-5 w-5 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Initializing Mol* Viewer...</span>
            </div>
          </div>
        )}
        
        {manualInitState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-70 z-10">
            <div className="bg-white p-4 rounded shadow max-w-md text-red-600">
              <p className="font-bold mb-2">Initialization Error:</p>
              <p className="mb-4">{error}</p>
              <button
                onClick={initializePlugin}
                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded"
              >
                Try Again
              </button>
            </div>
          </div>
        )}
        
        {children}
      </MolstarContext.Provider>
    );
  }
  
  // Regular rendering
  return (
    <MolstarContext.Provider value={contextValue}>
      {/* Hidden container for plugin initialization */}
      <div ref={containerRef} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} />
      {children}
    </MolstarContext.Provider>
  );
};

/**
 * useMolstar - Hook to access the Molstar context
 */
export function useMolstar() {
  const context = useContext(MolstarContext);
  if (!context) {
    throw new Error('useMolstar must be used within a MolstarProvider');
  }
  return context;
}

/**
 * withMolstar - HOC to wrap components with Molstar context
 */
export function withMolstar<P extends object>(
  Component: React.ComponentType<P & { molstar: MolstarContextType }>
): React.FC<P> {
  return (props: P) => {
    const molstar = useMolstar();
    return <Component {...props} molstar={molstar} />;
  };
}
