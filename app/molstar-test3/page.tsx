'use client'

import React, { useState } from 'react';
import { SimplifiedMolstarViewer, Domain } from '@/components/visualization/SimplifiedMolstarViewer';

export default function SimpleDomainPage() {
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
    },
    {
      id: '3',
      chainId: 'A',
      start: 201,
      end: 300,
      color: '#2ecc71',
      label: 'C-terminal Domain'
    }
  ]);
  
  const [newDomain, setNewDomain] = useState({
    chainId: 'A',
    start: 1,
    end: 100,
    color: '#3498db',
    label: ''
  });
  
  // Add a domain
  const addDomain = () => {
    const domain: Domain = {
      id: Math.random().toString(36).substring(7), // Simple ID generation
      chainId: newDomain.chainId,
      start: newDomain.start,
      end: newDomain.end,
      color: newDomain.color,
      label: newDomain.label || `Domain ${newDomain.start}-${newDomain.end}`
    };
    
    setDomains(prev => [...prev, domain]);
    
    // Reset form with incremented positions
    setNewDomain({
      chainId: newDomain.chainId,
      start: newDomain.end + 1,
      end: newDomain.end + 100,
      color: getRandomColor(),
      label: ''
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
  
  const handlePdbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdbId(e.target.value);
  };
  
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Simple Domain Visualization</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>PDB ID:</label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            value={pdbId} 
            onChange={handlePdbChange}
            style={{ 
              padding: '8px', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              width: '100px'
            }}
          />
        </div>
      </div>
      
      <SimplifiedMolstarViewer
        pdbId={pdbId}
        domains={domains}
        height="500px"
      />
      
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#f8f9fa', 
        marginTop: '20px',
        borderRadius: '6px',
        border: '1px solid #ddd'
      }}>
        <h2 style={{ marginTop: 0 }}>Domains</h2>
        
        {/* Domain List */}
        {domains.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '10px',
            marginBottom: '20px'
          }}>
            {domains.map(domain => (
              <div key={domain.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #eee'
              }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  backgroundColor: domain.color,
                  borderRadius: '50%',
                  marginRight: '10px'
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {domain.label}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Chain {domain.chainId}: {domain.start}-{domain.end}
                  </div>
                </div>
                <button 
                  onClick={() => removeDomain(domain.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '18px',
                    color: '#999'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#999' }}>No domains defined</p>
        )}
        
        {/* Add Domain Form */}
        <div style={{ 
          padding: '15px', 
          backgroundColor: 'white', 
          borderRadius: '4px',
          border: '1px solid #ddd'
        }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Add New Domain</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>
                Label
              </label>
              <input
                type="text"
                name="label"
                value={newDomain.label}
                onChange={handleChange}
                placeholder="Domain label"
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>
                Chain ID
              </label>
              <input
                type="text"
                name="chainId"
                value={newDomain.chainId}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>
                Start
              </label>
              <input
                type="number"
                name="start"
                value={newDomain.start}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>
                End
              </label>
              <input
                type="number"
                name="end"
                value={newDomain.end}
                onChange={handleChange}
                required
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '14px', marginBottom: '5px' }}>
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
          </div>
          
          <button 
            onClick={addDomain}
            style={{
              marginTop: '15px',
              padding: '8px 16px',
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
  );
}
