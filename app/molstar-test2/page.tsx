"use client"

import React from 'react';
import { SimpleDomainVisualizer } from '@/components/visualization/SimpleDomainVisualizer';

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
      <p>This example shows how to use the SimpleDomainVisualizer component with pre-defined domains.</p>

      <SimpleDomainVisualizer
        pdbId="1cbs"
        initialDomains={exampleDomains}
        height="600px"
      />

      <div style={{ marginTop: '20px' }}>
        <h2>Instructions</h2>
        <ul>
          <li>Domains are visualized in the 3D structure</li>
          <li>Add new domains by specifying chain ID, start, and end residues</li>
          <li>Remove domains by clicking the X button</li>
        </ul>
      </div>
    </div>
  );
}
