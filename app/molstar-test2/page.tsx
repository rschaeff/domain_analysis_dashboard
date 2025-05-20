import React from 'react';
import { DomainVisualizer } from '@/components/visualization/DomainVisualizer';

// Example domains
const exampleDomains = [
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
];

export default function DomainVisualizationExample() {
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Domain Visualization Example</h1>
      <p>This example shows how to use the DomainVisualizer component with pre-defined domains.</p>
      
      <DomainVisualizer 
        pdbId="1cbs"
        initialDomains={exampleDomains}
        height="600px"
      />
      
      <div style={{ marginTop: '20px' }}>
        <h2>Instructions</h2>
        <ul>
          <li>Click on domains in the list to highlight them in the 3D view</li>
          <li>Enter selection mode and select residues to create new domains</li>
          <li>Use the forms to manually define domains by residue range</li>
          <li>Edit existing domains by clicking on them in the list</li>
        </ul>
      </div>
    </div>
  );
}
