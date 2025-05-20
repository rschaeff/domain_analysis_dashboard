'use client'

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Domain } from '@/components/visualization/ThreeDMolViewer';

// Import the component with dynamic import with no SSR
const ThreeDMolViewer = dynamic(
  () => import('@/components/visualization/ThreeDMolViewer'),
  { ssr: false, loading: () => <div>Loading viewer...</div> }
);

interface ClientComponentProps {
  initialPdbId?: string;
}

const ThreeDMolClientComponent: React.FC<ClientComponentProps> = ({ 
  initialPdbId = '1cbs' 
}) => {
  const [pdbId, setPdbId] = useState(initialPdbId);
  
  // Static domains for testing
  const domains: Domain[] = [
    {
      id: '1',
      chainId: 'A',
      start: 1,
      end: 100,
      color: '#3498db',
      label: 'N-terminal Domain'
    },
    {
      id: '2',
      chainId: 'A',
      start: 101,
      end: 200,
      color: '#e74c3c',
      label: 'Central Domain'
    }
  ];
  
  // Track error state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Handle structure loading
  const handleStructureLoaded = () => {
    // Clear previous errors
    setErrorMessage(null);
  };
  
  // Handle errors
  const handleError = (error: string) => {
    setErrorMessage(error);
    // Using DOM methods to display error info
    const errorLog = document.getElementById('error-log');
    if (errorLog) {
      const item = document.createElement('div');
      item.textContent = `Error: ${error}`;
      item.style.color = 'red';
      errorLog.appendChild(item);
    }
  };
  
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px'
    }}>
      <h1>3DMol.js Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          PDB ID:
          <input 
            type="text" 
            value={pdbId} 
            onChange={(e) => setPdbId(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px' }}
          />
        </label>
        <button
          onClick={() => setPdbId(pdbId)}
          style={{ 
            marginLeft: '10px',
            padding: '5px 10px',
            backgroundColor: '#f1f1f1',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Load
        </button>
      </div>
      
      {/* Error display */}
      {errorMessage && (
        <div style={{
          padding: '10px',
          margin: '10px 0',
          backgroundColor: '#ffebee',
          border: '1px solid #ffcdd2',
          borderRadius: '4px',
          color: '#c62828'
        }}>
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
      
      {/* Viewer component */}
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '4px', 
        overflow: 'hidden'
      }}>
        <ThreeDMolViewer
          pdbId={pdbId}
          domains={domains}
          height="400px"
          showControls={true}
          onStructureLoaded={handleStructureLoaded}
          onError={handleError}
        />
      </div>
      
      {/* Debug info */}
      <div style={{ 
        marginTop: '20px', 
        padding: '10px',
        backgroundColor: '#f8f9fa',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Debug Information</h3>
        <div style={{ marginBottom: '10px' }}>
          <strong>Current PDB:</strong> {pdbId}
        </div>
        <div style={{ marginBottom: '10px' }}>
          <strong>Domains:</strong> {domains.length} defined
          <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
            {domains.map(domain => (
              <li key={domain.id} style={{ marginBottom: '5px' }}>
                {domain.label}: Chain {domain.chainId}, residues {domain.start}-{domain.end}
              </li>
            ))}
          </ul>
        </div>
        <div id="error-log" style={{ 
          marginTop: '10px',
          borderTop: '1px solid #ddd',
          paddingTop: '10px',
          maxHeight: '100px',
          overflow: 'auto'
        }}>
          <strong>Error Log:</strong>
        </div>
      </div>
    </div>
  );
};

export default ThreeDMolClientComponent;
