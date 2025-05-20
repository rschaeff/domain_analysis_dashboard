'use client'

import { useCallback, useEffect, useState } from 'react';
import { useDomainContext } from '../context/DomainContext';
import { MolScriptBuilder } from 'molstar/lib/mol-script/language/builder';
import { StateObjectSelector } from 'molstar/lib/mol-state';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { StructureElement } from 'molstar/lib/mol-model/structure';
import { ColorNames } from 'molstar/lib/mol-util/color/names';
import { createDomain } from '../types/domain';

export function useDomainVisualization() {
  const { plugin, domains, addDomain, removeDomain, updateDomain } = useDomainContext();
  const [structure, setStructure] = useState<StateObjectSelector<PluginStateObject.Molecule.Structure> | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  
  // Update current structure when hierarchy changes
  useEffect(() => {
    if (!plugin) return;
    
    const sub = plugin.managers.structure.hierarchy.behaviors.current.subscribe(current => {
      if (current.structures.length) {
        setStructure(current.structures[0]);
      } else {
        setStructure(null);
      }
    });
    
    return () => sub.unsubscribe();
  }, [plugin]);
  
  // Highlight a specific domain
  const highlightDomain = useCallback(async (domainId: string) => {
    if (!plugin || !structure) return;
    
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;
    
    setIsHighlighting(true);
    
    try {
      // Create domain expression
      const expression = MolScriptBuilder.struct.generator.atomGroups({
        'chain-test': MolScriptBuilder.core.rel.eq([
          MolScriptBuilder.struct.atomProperty.core.auth_asym_id(),
          domain.chainId
        ]),
        'residue-test': MolScriptBuilder.core.rel.inRange([
          MolScriptBuilder.struct.atomProperty.core.auth_seq_id(),
          domain.start,
          domain.end
        ])
      });
      
      // Create component for this domain
      const component = await plugin.builders.structure.tryCreateComponentFromExpression(
        structure,
        expression,
        `domain-${domain.id}`,
        { label: domain.label }
      );
      
      if (component) {
        // Apply visual representation
        await plugin.builders.structure.representation.addRepresentation(
          component,
          { 
            type: 'cartoon', 
            color: 'uniform', 
            colorParams: { value: ColorNames.parse(domain.color) }
          }
        );
      }
    } finally {
      setIsHighlighting(false);
    }
  }, [plugin, structure, domains]);
  
  // Highlight all domains
  const highlightAllDomains = useCallback(async () => {
    if (!plugin || !structure) return;
    
    setIsHighlighting(true);
    
    try {
      // Clear existing domain components first
      await clearDomainHighlights();
      
      // Create all domains sequentially
      for (const domain of domains) {
        await highlightDomain(domain.id);
      }
    } finally {
      setIsHighlighting(false);
    }
  }, [plugin, structure, domains, highlightDomain]);
  
  // Clear domain highlights
  const clearDomainHighlights = useCallback(async () => {
    if (!plugin || !structure) return;
    
    // Find and remove all domain components
    const state = plugin.state.data;
    const tree = state.tree;
    
    const toRemove = [];
    for (const ref of tree.children.get(structure.transform.ref)) {
      const obj = state.select(ref);
      if (obj?.transform.transformer.id.indexOf('structure-component') >= 0 && 
          obj?.transform.params?.key?.startsWith('domain-')) {
        toRemove.push(obj?.transform.ref);
      }
    }
    
    if (toRemove.length) {
      const update = state.build();
      for (const ref of toRemove) {
        update.delete(ref);
      }
      await update.commit();
    }
  }, [plugin, structure]);
  
  // Create domain from selection
  const createDomainFromSelection = useCallback(() => {
    if (!plugin || !structure) return;
    
    // Get the current selection
    const sel = plugin.managers.structure.selection.getLoci(structure.cell!.obj!.data);
    
    // Extract domain boundaries
    if (StructureElement.Loci.isEmpty(sel)) return;
    
    // Get chain ID and residue ranges
    const residueIndices: number[] = [];
    let chainId = '';
    
    for (const e of sel.elements) {
      if (e.unit.conformation.operator.name !== '1') continue; // Only use identity operator
      
      const loc = StructureElement.Location.create(sel.structure);
      for (let i = 0, il = e.indices.length; i < il; ++i) {
        loc.element = e.indices[i];
        StructureElement.Location.set(loc, sel.structure, e.unit, e.indices[i]);
        
        // Get auth_seq_id and auth_asym_id
        const residueIndex = StructureElement.Location.residueIndex(loc);
        chainId = StructureElement.Location.chain(loc);
        residueIndices.push(residueIndex);
      }
    }
    
    if (!residueIndices.length || !chainId) return;
    
    // Sort indices to get proper range
    residueIndices.sort((a, b) => a - b);
    
    // Create a new domain
    const domain = addDomain({
      chainId,
      start: residueIndices[0],
      end: residueIndices[residueIndices.length - 1]
    });
    
    // Highlight the newly created domain
    highlightDomain(domain.id);
    
    return domain;
  }, [plugin, structure, addDomain, highlightDomain]);
  
  return {
    highlightDomain,
    highlightAllDomains,
    clearDomainHighlights,
    createDomainFromSelection,
    isHighlighting,
    structure
  };
}
