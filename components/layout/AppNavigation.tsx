// components/layout/AppNavigation.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import {
  Database,
  BarChart3,
  UserCheck,
  AlertTriangle,
  Settings,
  ChevronDown,
  Activity,
  Users,
  Play,
  Edit3
} from 'lucide-react'

interface NavigationItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  isActive: (pathname: string) => boolean
}

interface CurationStatus {
  active_sessions: number
  total_curators: number
  proteins_pending: number
}

export function AppNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const [curationStatus, setCurationStatus] = useState<CurationStatus>({
    active_sessions: 0,
    total_curators: 0,
    proteins_pending: 0
  })
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)

  // Fetch curation status for navigation badges
  const fetchCurationStatus = async () => {
    try {
      const response = await fetch('/api/curation/stats')
      if (response.ok) {
        const data = await response.json()
        setCurationStatus({
          active_sessions: data.statistics?.active_sessions || 0,
          total_curators: data.statistics?.total_curators || 0,
          proteins_pending: data.statistics?.remaining_proteins || 0
        })
      }
    } catch (err) {
      console.error('Error fetching curation status:', err)
    }
  }

  useEffect(() => {
    fetchCurationStatus()
    
    // Refresh curation status every 30 seconds
    const interval = setInterval(fetchCurationStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const navigationItems: NavigationItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
      isActive: (path) => path.startsWith('/dashboard')
    },
    {
      label: 'Proteins',
      href: '/proteins',
      icon: Database,
      isActive: (path) => path.startsWith('/proteins') || path.startsWith('/protein/')
    },
    {
      label: 'Curation',
      href: '/curation',
      icon: UserCheck,
      badge: curationStatus.active_sessions > 0 ? curationStatus.active_sessions : undefined,
      badgeVariant: curationStatus.active_sessions > 0 ? 'default' : undefined,
      isActive: (path) => path.startsWith('/curation')
    },
    {
      label: 'Analysis',
      href: '/analysis',
      icon: AlertTriangle,
      isActive: (path) => path.startsWith('/analysis')
    }
  ]

  const handleQuickCuration = async () => {
    setLoading(true)
    try {
      // Quick start a curation session
      const response = await fetch('/api/curation/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curator_name: 'Quick Session', // Could be from user context
          batch_size: 5 // Smaller batch for quick curation
        })
      })

      if (response.ok) {
        router.push('/curation')
      } else {
        console.error('Failed to start quick curation session')
      }
    } catch (err) {
      console.error('Error starting quick curation:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">
                ECOD Analysis
              </h1>
            </div>
          </div>

          {/* Main Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navigationItems.map((item) => {
                const isActive = item.isActive(pathname)
                const IconComponent = item.icon

                return (
                  <Button
                    key={item.href}
                    variant={isActive ? 'default' : 'ghost'}
                    onClick={() => router.push(item.href)}
                    className="flex items-center gap-2"
                  >
                    <IconComponent className="w-4 h-4" />
                    {item.label}
                    {item.badge && (
                      <Badge 
                        variant={item.badgeVariant || 'secondary'} 
                        className="ml-1"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Curation Quick Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Curation Status Indicator */}
            {curationStatus.active_sessions > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>{curationStatus.active_sessions} active</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{curationStatus.total_curators}</span>
                </div>
              </div>
            )}

            {/* Quick Curation Button */}
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Curate
                <ChevronDown className="w-4 h-4" />
              </Button>

              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                  <div className="p-4 space-y-3">
                    <div className="text-sm font-medium text-gray-900">
                      Curation Options
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Pending Review:</span>
                        <span className="font-medium">{curationStatus.proteins_pending.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Active Sessions:</span>
                        <span className="font-medium">{curationStatus.active_sessions}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <Button
                        onClick={() => {
                          router.push('/curation')
                          setShowDropdown(false)
                        }}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <UserCheck className="w-4 h-4 mr-2" />
                        Open Curation Interface
                      </Button>

                      <Button
                        onClick={() => {
                          handleQuickCuration()
                          setShowDropdown(false)
                        }}
                        disabled={loading}
                        className="w-full justify-start"
                      >
                        {loading ? (
                          <LoadingSpinner size="sm" className="mr-2" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        Quick Start (5 proteins)
                      </Button>

                      <Button
                        onClick={() => {
                          router.push('/dashboard?view=curation')
                          setShowDropdown(false)
                        }}
                        variant="outline"
                        className="w-full justify-start"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        View Statistics
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm">
              <span className="sr-only">Open main menu</span>
              {/* Mobile menu icon */}
              <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </nav>
  )
}

// Optional: Lightweight curation status hook for other components
export function useCurationStatus() {
  const [status, setStatus] = useState<CurationStatus>({
    active_sessions: 0,
    total_curators: 0,
    proteins_pending: 0
  })

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/curation/stats')
      if (response.ok) {
        const data = await response.json()
        setStatus({
          active_sessions: data.statistics?.active_sessions || 0,
          total_curators: data.statistics?.total_curators || 0,
          proteins_pending: data.statistics?.remaining_proteins || 0
        })
      }
    } catch (err) {
      console.error('Error fetching curation status:', err)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 60000) // Every minute
    return () => clearInterval(interval)
  }, [])

  return { status, refresh: fetchStatus }
}
