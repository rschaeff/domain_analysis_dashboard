'use client'

import React, { useCallback, useState, useEffect } from 'react';
import { useDomainContext } from '../context/DomainContext';
import { useDomainVisualization } from '../hooks/useDomainVisualization';
import { SequenceView } from 'molstar/lib/mol-plugin-ui/sequence';
import { Domain } from '../types/domain';
import { Vec2 } from 'molstar/lib/mol-math/linear-algebra/3d/vec2';

interface SequenceViewWithDomainsProps {
  onRangeSelect?: (chainId: string, start: number, end: number) => void;
}

export const SequenceViewWithDomains: React.FC<SequenceViewWithDomainsProps> = ({ onRangeSelect }) => {
  const { plugin, domains, setActiveDomain, activeDomainId } = useDomainContext();
  const { createDomainFromSelection } = useDomainVisualization();
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<Vec2>({ x: 0, y: 0 });
  
  // When the selection mode changes, update interactivity
  useEffect(() => {
    if (!plugin) return;
    
    const sub = plugin.behaviors.interaction.selectionMode.subscribe(isSelectionMode => {
      if (!isSelectionMode) {
        setIsSelecting(false);
      }
    });
    
    return () => sub.unsubscribe();
  }, [plugin]);
  
  // Handle sequence click for domain selection
  const handleSequenceClick = useCallback((e: React.MouseEvent) => {
    if (!plugin) return;
    
    // If we're in selection mode, handle differently
    if (plugin.selectionMode) {
      if (!isSelecting) {
        setIsSelecting(true);
        setSelectionStart({ x: e.clientX, y: e.clientY });
      } else {
        setIsSelecting(false);
        
        // Create domain from selection
        const domain = createDomainFromSelection();
        if (domain && onRangeSelect) {
          onRangeSelect(domain.chainId, domain.start, domain.end);
        }
      }
      return;
    }
    
    // Regular click behavior
  }, [plugin, isSelecting, createDomainFromSelection, onRangeSelect]);
  
  // Render domain annotations on sequence
  const renderDomainAnnotations = () => {
    return domains.map((domain) => (
      <DomainAnnotation 
        key={domain.id}
        domain={domain}
        isActive={domain.id === activeDomainId}
        onClick={() => setActiveDomain(domain.id === activeDomainId ? null : domain.id)}
      />
    ));
  };
  
  return (
    <div className="sequence-view-with-domains">
      <div className="domain-annotations">
        {renderDomainAnnotations()}
      </div>
      <div onClick={handleSequenceClick}>
        {plugin ? <SequenceView /> : <div>Loading sequence...</div>}
      </div>
    </div>
  );
};

// Domain annotation component
interface DomainAnnotationProps {
  domain: Domain;
  isActive: boolean;
  onClick: () => void;
}

const DomainAnnotation: React.FC<DomainAnnotationProps> = ({ domain, isActive, onClick }) => {
  // Calculate position based on sequence view (this will need adjustment based on your sequence view implementation)
  const style = {
    backgroundColor: domain.color,
    opacity: isActive ? 1 : 0.7,
    cursor: 'pointer',
    // Positioning would be calculated based on the specific sequence view implementation
  };
  
  return (
    <div 
      className={`domain-annotation ${isActive ? 'active' : ''}`}
      style={style}
      onClick={onClick}
      title={`${domain.label} (${domain.start}-${domain.end})`}
    />
  );
};
