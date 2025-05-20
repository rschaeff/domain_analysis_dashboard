"use client"

import React, { useState, useEffect } from 'react';
import { VanillaMolstarViewer } from './molstar/VanillaMolstarViewer';
import { Domain, createDomain } from './molstar/types/domain';

interface SimpleDomainVisualizerProps {
  pdbId: string;
  initialDomains?: Domain[];
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const SimpleDomainVisualizer: React.FC<SimpleDomainVisualizerProps> = ({
  pdbId,
  initialDomains = [],
  width = '100%',
  height = '500px',
  className = '',
  style = {}
}) => {
  const [domains, setDomains] = useState<Domain[]>(initialDomains);
  const [newDomain, setNewDomain] = useState({
    chainId: 'A',
    start: 1,
    end: 100,
    label: '',
    color: '#3498db'
  });
  
  // Add a domain
  const addDomain = () => {
    const domain = createDomain(newDomain);
    setDomains(prev => [...prev, domain]);
    
    // Reset form
    setNewDomain({
      chainId: newDomain.chainId,
      start: newDomain.end + 1,
      end: newDomain.end + 100,
      label: '',
      color: getRandomColor()
    });
  };
  
  // Remove a domain
  const removeDomain = (domainId: string) => {
    setDomains(prev => prev.filter(d => d.id !== domainId));
  };
  
  // Get a random color
  function getRandomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
  }
  
  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewDomain(prev => ({
      ...prev,
      [name]: name === 'start' || name === 'end' ? parseInt(value) : value
    }));
  };
  
  return (
    <div 
      className={`simple-domain-visualizer ${className}`}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width, 
        height,
        border: '1px solid #ddd',
        borderRadius: '4px',
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Structure Viewer */}
      <div style={{ flex: '1 1 auto', position: 'relative' }}>
        <VanillaMolstarViewer 
          pdbId={pdbId}
          domains={domains}
          width="100%"
          height="100%"
        />
      </div>
      
      {/* Domain Controls */}
      <div style={{ 
        padding: '10px', 
        backgroundColor: '#f8f9fa', 
        borderTop: '1px solid #ddd',
        maxHeight: '300px',
        overflowY: 'auto'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Domains ({domains.length})</h3>
        
        {/* Domain List */}
        {domains.length > 0 ? (
          <ul style={{ 
            listStyle: 'none', 
            padding: 0, 
            margin: '0 0 15px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px'
          }}>
            {domains.map(domain => (
              <li key={domain.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 10px',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #eee'
              }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  backgroundColor: domain.color,
                  borderRadius: '50%',
                  marginRight: '8px'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    {domain.label || `Domain ${domain.id.substring(0, 8)}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Chain {domain.chainId}: {domain.start}-{domain.end}
                  </div>
                </div>
                <button 
                  onClick={() => removeDomain(domain.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#999'
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ textAlign: 'center', color: '#999' }}>No domains defined</p>
        )}
        
        {/* Add Domain Form */}
        <div style={{ 
          padding: '10px', 
          backgroundColor: 'white', 
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Add New Domain</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Label
              </label>
              <input
                type="text"
                name="label"
                value={newDomain.label}
                onChange={handleChange}
                placeholder="Domain label"
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Chain ID
              </label>
              <input
                type="text"
                name="chainId"
                value={newDomain.chainId}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Start
              </label>
              <input
                type="number"
                name="start"
                value={newDomain.start}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                End
              </label>
              <input
                type="number"
                name="end"
                value={newDomain.end}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Color
              </label>
              <input
                type="color"
                name="color"
                value={newDomain.color}
                onChange={handleChange}
                style={{ width: '100%', padding: '2px', border: '1px solid #ddd', borderRadius: '4px', height: '34px' }}
              />
            </div>
            
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
                onClick={addDomain}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Add Domain
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
