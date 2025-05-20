'use client'

import React, { useState } from 'react';
import FixedMolstarViewer, { Domain } from '@/components/visualization/FixedMolstarViewer';

export default function SimplifiedTestPage() {
  const [pdbId, setPdbId] = useState('1cbs');
  const [domains, setDomains] = useState<Domain[]>([
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
  ]);
  
  const handlePdbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdbId(e.target.value);
  };
  
  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px'
    }}>
      <h1>Molstar Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          PDB ID:
          <input 
            type="text" 
            value={pdbId} 
            onChange={handlePdbChange}
            style={{ marginLeft: '10px' }}
          />
        </label>
      </div>
      
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '4px', 
        overflow: 'hidden'
      }}>
        <FixedMolstarViewer
          pdbId={pdbId}
          domains={domains}
          height="400px"
          showControls={true}
          onError={(error) => console.error("Viewer error:", error)}
        />
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h2>Current Domains</h2>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '10px'
        }}>
          {domains.map(domain => (
            <div key={domain.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}>
              <div style={{ 
                width: '20px', 
                height: '20px', 
                borderRadius: '50%',
                backgroundColor: domain.color,
                marginRight: '10px'
              }} />
              <div>
                <div><strong>{domain.label}</strong></div>
                <div>Chain {domain.chainId}: {domain.start}-{domain.end}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
