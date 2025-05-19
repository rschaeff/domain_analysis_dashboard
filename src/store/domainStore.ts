import { create } from 'zustand'
import { DomainFilters, DomainSummary, PaginationParams, SortParams } from '@/lib/types'

interface DomainStore {
  // State
  domains: DomainSummary[]
  selectedDomains: Set<number>
  filters: DomainFilters
  pagination: PaginationParams
  sort: SortParams
  loading: boolean
  error: string | null

  // Actions
  setDomains: (domains: DomainSummary[]) => void
  setSelectedDomains: (domainIds: Set<number>) => void
  addSelectedDomain: (domainId: number) => void
  removeSelectedDomain: (domainId: number) => void
  clearSelectedDomains: () => void
  setFilters: (filters: DomainFilters) => void
  updateFilter: <K extends keyof DomainFilters>(key: K, value: DomainFilters[K]) => void
  clearFilters: () => void
  setPagination: (pagination: Partial<PaginationParams>) => void
  setSort: (sort: SortParams) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Computed
  getSelectedDomainsArray: () => DomainSummary[]
  hasActiveFilters: () => boolean
}

export const useDomainStore = create<DomainStore>((set, get) => ({
  // Initial state
  domains: [],
  selectedDomains: new Set(),
  filters: {},
  pagination: { page: 1, size: 50, total: 0 },
  sort: { field: 'pdb_id', direction: 'asc' },
  loading: false,
  error: null,

  // Actions
  setDomains: (domains) => set({ domains }),
  
  setSelectedDomains: (domainIds) => set({ selectedDomains: domainIds }),
  
  addSelectedDomain: (domainId) => set((state) => ({
    selectedDomains: new Set([...state.selectedDomains, domainId])
  })),
  
  removeSelectedDomain: (domainId) => set((state) => {
    const newSelected = new Set(state.selectedDomains)
    newSelected.delete(domainId)
    return { selectedDomains: newSelected }
  }),
  
  clearSelectedDomains: () => set({ selectedDomains: new Set() }),
  
  setFilters: (filters) => set({ filters }),
  
  updateFilter: (key, value) => set((state) => ({
    filters: { ...state.filters, [key]: value }
  })),
  
  clearFilters: () => set({ filters: {} }),
  
  setPagination: (pagination) => set((state) => ({
    pagination: { ...state.pagination, ...pagination }
  })),
  
  setSort: (sort) => set({ sort }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error }),

  // Computed
  getSelectedDomainsArray: () => {
    const { domains, selectedDomains } = get()
    return domains.filter(domain => selectedDomains.has(domain.id))
  },
  
  hasActiveFilters: () => {
    const { filters } = get()
    return Object.keys(filters).length > 0
  }
}))
