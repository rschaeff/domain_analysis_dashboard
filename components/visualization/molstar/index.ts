// components/visualization/molstar/index.ts
// Public API for Molstar components

// Main components
export { MolstarViewer } from './components/MolstarViewer';
export { MolstarCanvas } from './components/MolstarCanvas';

// Context
export { 
  MolstarProvider, 
  useMolstar,
  type MolstarContextType 
} from './context/MolstarContext';

// Hooks
export { 
  useStructureLoader,
  type StructureInfo,
  type StructureLoaderResult 
} from './hooks/useStructureLoader';

export { 
  useDomainViewer,
  type Domain,
  type DomainViewerResult,
  T_GROUP_COLORS 
} from './hooks/useDomainViewer';

// Utilities
export {
  detectFormatFromContent,
  detectFormatFromContentType,
  getValidFormatName,
  getFileExtension,
  SupportedFormats
} from './utils/formats';
