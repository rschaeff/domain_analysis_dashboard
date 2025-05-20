'use client'

import React, { useState, useEffect } from 'react';
import MolstarCanvas, { Domain } from '@/components/visualization/MolstarCanvas';

export default function DomainVisualizationPage() {
  const [pdbId, setPdbId] = useState('1cbs');
  const [chainId, setChainId] = useState('A');
  const [domainGroups, setDomainGroups] = useState<Record<string, Domain[]>>({
    '1cbs': [
      {
        id: '1',
        chainId: 'A',
        start: 1,
        end: 100,
        color: '#3498db',
        label: 'N-terminal Domain',
        classification: {
          t_group: '1.1.1',
          h_group: '1.1',
          x_group: '1',
        }
      },
      {
        id: '2',
        chainId: 'A',
        start: 101,
        end: 200,
        color: '#e74c3c',
        label: 'Central Domain',
        classification: {
          t_group: '2.1.1',
          h_group: '2.1',
          x_group: '2',
        }
      },
      {
        id: '3',
        chainId: 'A',
        start: 201,
        end: 300,
        color: '#2ecc71',
        label: 'C-terminal Domain',
        classification: {
          t_group: '3.1.1',
          h_group: '3.1',
          x_group: '3',
        }
      }
    ],
    '4hhb': [
      {
        id: '1', 
        chainId: 'A',
        start: 1,
        end: 141,
        color: '#9b59b6',
        label: 'Alpha Chain',
        classification: {
          t_group: '1.10.490.10',
          h_group: '1.10.490',
          x_group: '1.10',
        }
      }
    ],
    '1tim': [
      {
        id: '1',
        chainId: 'A',
        start: 1,
        end: 247,
        color: '#f39c12',
        label: 'TIM Barrel',
        classification: {
          t_group: '3.20.20.70',
          h_group: '3.20.20',
          x_group: '3.20',
        }
      }
    ]
  });
  
  const [currentDomains, setCurrentDomains] = useState<Domain[]>(domainGroups['1cbs'] || []);
  
  const [newDomain, setNewDomain] = useState({
    chainId: 'A',
    start: 1,
    end: 100,
    color: '#3498db',
    label: '',
    classification: {
      t_group: '',
      h_group: '',
      x_group: '',
    }
  });
  
  // Update current domains when PDB ID changes
  useEffect(() => {
    if (domainGroups[pdbId]) {
      // Filter domains for the current chain
      const chainDomains = domainGroups[pdbId].filter(d => d.chainId === chainId);
      setCurrentDomains(chainDomains);
    } else {
      setCurrentDomains([]);
    }
  }, [pdbId, chainId, domainGroups]);
  
  // Add a domain
  const addDomain = () => {
    const domain: Domain = {
      id: Math.random().toString(36).substring(7), // Simple ID generation
      chainId: newDomain.chainId,
      start: newDomain.start,
      end: newDomain.end,
      color: newDomain.color,
      label: newDomain.label || `Domain ${newDomain.start}-${newDomain.end}`,
      classification: {
        t_group: newDomain.classification.t_group || undefined,
        h_group: newDomain.classification.h_group || undefined,
        x_group: newDomain.classification.x_group || undefined,
      }
    };
    
    // Add to current domains
    setCurrentDomains(prev => [...prev, domain]);
    
    // Add to domain groups
    setDomainGroups(prev => ({
      ...prev,
      [pdbId]: [...(prev[pdbId] || []), domain]
    }));
    
    // Reset form with incremented positions
    setNewDomain({
      chainId: newDomain.chainId,
      start: newDomain.end + 1,
      end: newDomain.end + 100,
      color: getRandomColor(),
      label: '',
      classification: {
        t_group: '',
        h_group: '',
        x_group: '',
      }
    });
  };
  
  // Remove a domain
  const removeDomain = (domainId: string) => {
    // Remove from current domains
    setCurrentDomains(prev => prev.filter(d => d.id !== domainId));
    
    // Remove from domain groups
    setDomainGroups(prev => ({
      ...prev,
      [pdbId]: prev[pdbId].filter(d => d.id !== domainId)
    }));
  };
  
  // Get a random color
  function getRandomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
  }
  
  // Format classification string
  function formatClassification(domain: Domain): string {
    const { classification } = domain;
    if (!classification) return 'Unclassified';
    
    const parts = [];
    if (classification.t_group) parts.push(`T: ${classification.t_group}`);
    if (classification.h_group) parts.push(`H: ${classification.h_group}`);
    if (classification.x_group) parts.push(`X: ${classification.x_group}`);
    if (classification.a_group) parts.push(`A: ${classification.a_group}`);
    
    return parts.length > 0 ? parts.join(', ') : 'Unclassified';
  }
  
  // Handle form changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('classification.')) {
      // Handle nested classification properties
      const classKey = name.split('.')[1] as keyof typeof newDomain.classification;
      setNewDomain(prev => ({
        ...prev,
        classification: {
          ...prev.classification,
          [classKey]: value
        }
      }));
    } else {
      // Handle direct properties
      setNewDomain(prev => ({
        ...prev,
        [name]: name === 'start' || name === 'end' ? parseInt(value) : value
      }));
    }
  };
  
  // Preset PDBs
  const presetPdbs = [
    { id: '1cbs', name: 'Cellular retinoic acid-binding protein', chains: ['A'] },
    { id: '4hhb', name: 'Hemoglobin', chains: ['A', 'B', 'C', 'D'] },
    { id: '1tim', name: 'Triosephosphate Isomerase', chains: ['A', 'B'] },
    { id: '7jtl', name: 'SARS-CoV-2 Spike Protein', chains: ['A', 'B', 'C'] },
    { id: '6vxx', name: 'SARS-CoV-2 Spike Glycoprotein', chains: ['A', 'B', 'C'] }
  ];
  
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>ECOD Domain Visualization</h1>
      <p>This example demonstrates protein domain visualization using Molstar with a direct canvas implementation.</p>
      
      <div style={{ 
        display: 'flex', 
        gap: '20px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>PDB ID:</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={pdbId}
                onChange={(e) => setPdbId(e.target.value)}
                style={{ 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  flex: '1'
                }}
              >
                {presetPdbs.map(pdb => (
                  <option key={pdb.id} value={pdb.id}>
                    {pdb.id} - {pdb.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Chain ID:</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <select
                value={chainId}
                onChange={(e) => setChainId(e.target.value)}
                style={{ 
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  flex: '1'
                }}
              >
                {presetPdbs.find(p => p.id === pdbId)?.chains.map(chain => (
                  <option key={chain} value={chain}>
                    Chain {chain}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <div style={{ flex: '1', minWidth: '300px' }}>
          <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>Current Structure:</div>
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{pdbId.toUpperCase()}</div>
            <div>
              {presetPdbs.find(p => p.id === pdbId)?.name}
              {' | '} 
              Chain {chainId}
            </div>
            <div style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>
              {currentDomains.length} domain{currentDomains.length !== 1 ? 's' : ''} defined
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '6px', 
        overflow: 'hidden',
        marginBottom: '20px'
      }}>
        <MolstarCanvas
          pdbId={pdbId}
          chainId={chainId}
          domains={currentDomains}
          height="500px"
          showControls={true}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ 
          flex: '3',
          minWidth: '400px',
          padding: '20px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '6px',
          border: '1px solid #ddd'
        }}>
          <h2 style={{ marginTop: 0 }}>Domain Management</h2>
          
          {/* Domain List */}
          <h3>Domains for {pdbId.toUpperCase()} Chain {chainId}</h3>
          {currentDomains.length > 0 ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '10px',
              marginBottom: '20px'
            }}>
              {currentDomains.map(domain => (
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
                      Range: {domain.start}-{domain.end}
                    </div>
                    <div style={{ fontSize: '12px', color: '#777', marginTop: '2px' }}>
                      {formatClassification(domain)}
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
            <div style={{ 
              textAlign: 'center', 
              color: '#666', 
              padding: '20px', 
              backgroundColor: 'white', 
              borderRadius: '4px', 
              border: '1px solid #eee' 
            }}>
              No domains defined for this structure. Add domains using the form below.
            </div>
          )}
          
          {/* Add Domain Form */}
          <div style={{ 
            padding: '15px', 
            backgroundColor: 'white', 
            borderRadius: '4px',
            border: '1px solid #ddd',
            marginTop: '20px'
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
                <select
                  name="chainId"
                  value={newDomain.chainId}
                  onChange={(e) => setNewDomain(prev => ({ ...prev, chainId: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                >
                  {presetPdbs.find(p => p.id === pdbId)?.chains.map(chain => (
                    <option key={chain} value={chain}>Chain {chain}</option>
                  ))}
                </select>
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
            
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Classification:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '3px' }}>
                    T-Group
                  </label>
                  <input
                    type="text"
                    name="classification.t_group"
                    value={newDomain.classification.t_group}
                    onChange={handleChange}
                    placeholder="e.g., 3.40.50.300"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '3px' }}>
                    H-Group
                  </label>
                  <input
                    type="text"
                    name="classification.h_group"
                    value={newDomain.classification.h_group}
                    onChange={handleChange}
                    placeholder="e.g., 3.40.50"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '12px', marginBottom: '3px' }}>
                    X-Group
                  </label>
                  <input
                    type="text"
                    name="classification.x_group"
                    value={newDomain.classification.x_group}
                    onChange={handleChange}
                    placeholder="e.g., 3.40"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </div>
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
        
        <div style={{ 
          flex: '1',
          minWidth: '300px',
          padding: '20px',
          backgroundColor: '#e8f4fd',
          borderRadius: '6px',
          border: '1px solid #bde0fd'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#2980b9' }}>About ECOD Domain Visualization</h3>
          
          <div style={{ fontSize: '14px' }}>
            <p>
              This component provides a visualization of protein domains as classified by the 
              Evolutionary Classification of Protein Domains (ECOD) database.
            </p>
            
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Classification Hierarchy:</div>
              <ul style={{ paddingLeft: '20px', margin: '0' }}>
                <li><strong>X-group</strong>: Architecture level</li>
                <li><strong>H-group</strong>: Homology level</li>
                <li><strong>T-group</strong>: Topology level</li>
                <li><strong>A-group</strong>: Family level</li>
              </ul>
            </div>
            
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Key Features:</div>
              <ul style={{ paddingLeft: '20px', margin: '0' }}>
                <li>Interactive 3D visualization using Molstar</li>
                <li>Domain boundary definition and visualization</li>
                <li>Classification hierarchy support</li>
                <li>Multi-chain structure support</li>
                <li>Screenshot capability for publications</li>
              </ul>
            </div>
            
            <div style={{ marginTop: '15px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Implementation Notes:</div>
              <p style={{ margin: '0' }}>
                This implementation uses a direct canvas approach that bypasses 
                the React context system in Molstar, avoiding compatibility issues with Next.js.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
