/**
 * MolstarCanvas - Component for rendering a Molstar canvas
 * 
 * This component handles the canvas element and integration with the Molstar plugin.
 * It provides a clean React wrapper for Molstar's canvas rendering.
 */
import React, { useRef, useEffect } from 'react';
import { useMolstar } from './MolstarContext';

// Types
export interface MolstarCanvasProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  transparentBackground?: boolean;
  showControls?: boolean;
}

/**
 * MolstarCanvas - Component that renders the Molstar 3D canvas
 */
export const MolstarCanvas: React.FC<MolstarCanvasProps> = ({
  width = '100%',
  height = '400px',
  className = '',
  style = {},
  transparentBackground = false,
  showControls = false
}) => {
  // Context
  const { plugin, isInitialized, isBusy, addLog } = useMolstar();
  
  // Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  // Setup canvas when plugin is initialized
  useEffect(() => {
    if (!plugin || !isInitialized || !canvasContainerRef.current) return;
    
    try {
      addLog('Setting up canvas');
      
      // Get the canvas element from the plugin
      const canvas = plugin.canvas3d?.canvas.element;
      
      if (!canvas) {
        addLog('Canvas element not found', 'error');
        return;
      }
      
      // Set background if specified
      if (transparentBackground) {
        plugin.canvas3d?.setProps({
          backgroundColor: { r: 0, g: 0, b: 0, a: 0 } // Transparent background
        });
      }
      
      // Add canvas to the container
      const container = canvasContainerRef.current;
      
      // Only add if it's not already attached
      if (canvas.parentElement !== container) {
        // First, remove from current parent if any
        if (canvas.parentElement) {
          canvas.parentElement.removeChild(canvas);
        }
        
        // Configure canvas style
        Object.assign(canvas.style, {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        });
        
        // Add to our container
        container.appendChild(canvas);
        
        // Setup resize observer for responsive sizing
        const resizeObserver = new ResizeObserver(() => {
          if (plugin && plugin.canvas3d) {
            plugin.canvas3d.handleResize();
          }
        });
        
        resizeObserver.observe(container);
        
        // Handle the initial resize
        plugin.canvas3d?.handleResize();
        
        // Return cleanup function
        return () => {
          try {
            resizeObserver.disconnect();
            
            // Don't remove the canvas on unmount since it's managed by the plugin
            // We just need to make sure we don't leak the resize observer
          } catch (err) {
            console.error('Error during canvas cleanup:', err);
          }
        };
      }
    } catch (err) {
      addLog(`Error setting up canvas: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, [plugin, isInitialized, transparentBackground, addLog]);
  
  // Calculate container style
  const containerStyle: React.CSSProperties = {
    position: 'relative',
    width,
    height,
    overflow: 'hidden',
    ...style
  };
  
  // Add controls class if needed
  useEffect(() => {
    if (!plugin || !isInitialized) return;
    
    try {
      // Toggle viewport controls
      const canvasElement = plugin.canvas3d?.canvas.element;
      
      if (canvasElement) {
        const controls = plugin.layout.state.regionState.get({ name: 'viewport-controls' });
        
        if (controls) {
          plugin.layout.state.regionState.set({
            name: 'viewport-controls',
            isCollapsed: !showControls
          });
        }
      }
    } catch (err) {
      console.error('Error toggling controls:', err);
    }
  }, [plugin, isInitialized, showControls]);
  
  return (
    <div 
      ref={canvasContainerRef}
      className={`molstar-canvas-container ${className}`}
      style={containerStyle}
      data-testid="molstar-canvas"
    >
      {/* Loading indicator */}
      {isBusy && (
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.5)',
            zIndex: 10
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <svg className="animate-spin h-8 w-8 text-blue-500 m-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>Loading...</div>
          </div>
        </div>
      )}
    </div>
  );
};
