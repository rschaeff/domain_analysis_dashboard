import React, { useState } from 'react';
import { useDomainContext } from '../context/DomainContext';
import { useDomainVisualization } from '../hooks/useDomainVisualization';
import { Domain } from '../types/domain';

interface DomainControlsProps {
  className?: string;
}

export const DomainControls: React.FC<DomainControlsProps> = ({ className = '' }) => {
  const { domains, activeDomainId, updateDomain, removeDomain, setActiveDomain } = useDomainContext();
  const { highlightDomain, highlightAllDomains, clearDomainHighlights, createDomainFromSelection } = useDomainVisualization();
  
  const activeDomain = domains.find(d => d.id === activeDomainId);
  
  return (
    <div className={`domain-controls ${className}`}>
      <div className="domain-actions">
        <button onClick={createDomainFromSelection}>
          Create Domain from Selection
        </button>
        <button onClick={highlightAllDomains}>
          Show All Domains
        </button>
        <button onClick={clearDomainHighlights}>
          Hide All Domains
        </button>
      </div>
      
      <div className="domain-list">
        <h3>Domains ({domains.length})</h3>
        {domains.length === 0 ? (
          <div className="no-domains">No domains defined</div>
        ) : (
          <ul>
            {domains.map(domain => (
              <DomainListItem 
                key={domain.id}
                domain={domain}
                isActive={domain.id === activeDomainId}
                onSelect={() => {
                  setActiveDomain(domain.id === activeDomainId ? null : domain.id);
                  highlightDomain(domain.id);
                }}
                onDelete={() => removeDomain(domain.id)}
              />
            ))}
          </ul>
        )}
      </div>
      
      {activeDomain && (
        <DomainEditor 
          domain={activeDomain} 
          onUpdate={updateDomain}
          onClose={() => setActiveDomain(null)}
        />
      )}
      
      <AddDomainForm />
    </div>
  );
};

// Domain list item component
interface DomainListItemProps {
  domain: Domain;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

const DomainListItem: React.FC<DomainListItemProps> = ({ domain, isActive, onSelect, onDelete }) => {
  return (
    <li className={`domain-item ${isActive ? 'active' : ''}`}>
      <div className="domain-color" style={{ backgroundColor: domain.color }} />
      <div className="domain-info" onClick={onSelect}>
        <div className="domain-name">{domain.label}</div>
        <div className="domain-range">
          Chain {domain.chainId}: {domain.start}-{domain.end}
        </div>
      </div>
      <button className="domain-delete" onClick={onDelete}>
        &times;
      </button>
    </li>
  );
};

// Domain editor component
interface DomainEditorProps {
  domain: Domain;
  onUpdate: (domain: Domain) => void;
  onClose: () => void;
}

const DomainEditor: React.FC<DomainEditorProps> = ({ domain, onUpdate, onClose }) => {
  const [editedDomain, setEditedDomain] = useState({ ...domain });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedDomain(prev => ({
      ...prev,
      [name]: name === 'start' || name === 'end' ? parseInt(value) : value
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(editedDomain);
    onClose();
  };
  
  return (
    <div className="domain-editor">
      <h3>Edit Domain</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Label</label>
          <input
            type="text"
            name="label"
            value={editedDomain.label}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-group">
          <label>Chain ID</label>
          <input
            type="text"
            name="chainId"
            value={editedDomain.chainId}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Start</label>
            <input
              type="number"
              name="start"
              value={editedDomain.start}
              onChange={handleChange}
            />
          </div>
          
          <div className="form-group">
            <label>End</label>
            <input
              type="number"
              name="end"
              value={editedDomain.end}
              onChange={handleChange}
            />
          </div>
        </div>
        
        <div className="form-group">
          <label>Color</label>
          <input
            type="color"
            name="color"
            value={editedDomain.color}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-actions">
          <button type="submit">Save</button>
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

// Add domain form component
const AddDomainForm: React.FC = () => {
  const { addDomain } = useDomainContext();
  const [showForm, setShowForm] = useState(false);
  const [newDomain, setNewDomain] = useState({
    chainId: 'A',
    start: 1,
    end: 100,
    label: '',
    color: '#3498db'
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewDomain(prev => ({
      ...prev,
      [name]: name === 'start' || name === 'end' ? parseInt(value) : value
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addDomain(newDomain);
    setShowForm(false);
    setNewDomain({
      chainId: 'A',
      start: 1,
      end: 100,
      label: '',
      color: '#3498db'
    });
  };
  
  if (!showForm) {
    return (
      <button className="add-domain-button" onClick={() => setShowForm(true)}>
        Add Domain
      </button>
    );
  }
  
  return (
    <div className="add-domain-form">
      <h3>Add New Domain</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Label</label>
          <input
            type="text"
            name="label"
            value={newDomain.label}
            onChange={handleChange}
            placeholder="Domain label"
          />
        </div>
        
        <div className="form-group">
          <label>Chain ID</label>
          <input
            type="text"
            name="chainId"
            value={newDomain.chainId}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label>Start</label>
            <input
              type="number"
              name="start"
              value={newDomain.start}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label>End</label>
            <input
              type="number"
              name="end"
              value={newDomain.end}
              onChange={handleChange}
              required
            />
          </div>
        </div>
        
        <div className="form-group">
          <label>Color</label>
          <input
            type="color"
            name="color"
            value={newDomain.color}
            onChange={handleChange}
          />
        </div>
        
        <div className="form-actions">
          <button type="submit">Add</button>
          <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      </form>
    </div>
  );
};
