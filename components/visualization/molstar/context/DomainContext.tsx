'use client'

import React, { createContext, useState, useContext, useCallback, useMemo } from 'react';
import { Domain, createDomain } from '../types/domain';
import { PluginContext } from 'molstar/lib/mol-plugin/context';

interface DomainContextValue {
  domains: Domain[];
  activeDomainId: string | null;
  
  addDomain: (params: Partial<Domain> & { chainId: string; start: number; end: number }) => Domain;
  updateDomain: (domain: Domain) => void;
  removeDomain: (domainId: string) => void;
  setActiveDomain: (domainId: string | null) => void;
  
  plugin: PluginContext | null;
  setPlugin: (plugin: PluginContext | null) => void;
}

const DomainContext = createContext<DomainContextValue | null>(null);

export const DomainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [activeDomainId, setActiveDomainId] = useState<string | null>(null);
  const [plugin, setPluginState] = useState<PluginContext | null>(null);
  
  const addDomain = useCallback((params: Partial<Domain> & { chainId: string; start: number; end: number }) => {
    const domain = createDomain(params);
    setDomains(prev => [...prev, domain]);
    return domain;
  }, []);
  
  const updateDomain = useCallback((domain: Domain) => {
    setDomains(prev => prev.map(d => d.id === domain.id ? domain : d));
  }, []);
  
  const removeDomain = useCallback((domainId: string) => {
    setDomains(prev => prev.filter(d => d.id !== domainId));
    if (activeDomainId === domainId) {
      setActiveDomainId(null);
    }
  }, [activeDomainId]);
  
  const setPlugin = useCallback((newPlugin: PluginContext | null) => {
    setPluginState(newPlugin);
  }, []);
  
  const contextValue = useMemo(() => ({
    domains,
    activeDomainId, 
    addDomain,
    updateDomain,
    removeDomain,
    setActiveDomain: setActiveDomainId,
    plugin,
    setPlugin
  }), [domains, activeDomainId, addDomain, updateDomain, removeDomain, plugin, setPlugin]);
  
  return (
    <DomainContext.Provider value={contextValue}>
      {children}
    </DomainContext.Provider>
  );
};

export function useDomainContext() {
  const context = useContext(DomainContext);
  if (!context) {
    throw new Error('useDomainContext must be used within a DomainProvider');
  }
  return context;
}
