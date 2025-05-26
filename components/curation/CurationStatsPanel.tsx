// components/curation/CurationStatsPanel.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  BarChart3, 
  TrendingUp,
  RefreshCw,
  Activity,
  Target,
  Star
} from 'lucide-react'

interface CurationStatistics {
  total_sessions: number
  committed_sessions: number
  active_sessions: number
  total_curators: number
  total_decisions: number
  proteins_with_domains: number
  fragments_identified: number
  repeat_proteins: number
  flagged_for_review: number
  avg_confidence_level: number
  avg_review_time_seconds: number
  proteins_curated: number
  total_curable_proteins: number
  completion_percentage: number
  remaining_proteins: number
}

interface RecentActivity {
  id: number
  curator_name: string
  status: string
  proteins_reviewed: number
  target_batch_size: number
  created_at: string
  session_end?: string
}

export function CurationStatsPanel() {
  const [statistics, setStatistics] = useState<CurationStatistics | null>(null)
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCurationStats = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/curation/stats')
      if (response.ok) {
        const data = await response.json()
        setStatistics(data.statistics)
        setRecentActivity(data.recent_activity || [])
      } else {
        throw new Error('Failed to fetch curation statistics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const cleanupExpiredLocks = async () => {
    try {
      const response = await fetch('/api/curation/cleanup', { method: 'POST' })
      if (response.ok) {
        const data = await response.json()
        console.log('Cleanup completed:', data)
        // Refresh stats after cleanup
        fetchCurationStats()
      }
    } catch (err) {
      console.error('Cleanup error:', err)
    }
  }

  useEffect(() => {
    fetchCurationStats()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCurationStats, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <LoadingSpinner />
          <span className="ml-2">Loading curation statistics...</span>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-red-800">Error loading curation stats: {error}</span>
          </div>
          <Button onClick={fetchCurationStats} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (!statistics) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Curation Overview</h2>
          <p className="text-gray-600">Manual review and validation of protein domain assignments</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            onClick={fetchCurationStats} 
            variant="outline" 
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={cleanupExpiredLocks} 
            variant="outline" 
            size="sm"
          >
            <AlertTriangle className="w-4 h-4 mr-1" />
            Cleanup
          </Button>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Curation Progress</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {statistics.proteins_curated.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Proteins Curated</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {statistics.remaining_proteins.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Remaining</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {statistics.completion_percentage.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Complete</div>
          </div>
          
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {statistics.total_curable_proteins.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Available</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{statistics.completion_percentage.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(statistics.completion_percentage, 100)}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Session Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {statistics.active_sessions}
              </div>
              <div className="text-sm text-gray-600">Active Sessions</div>
              {statistics.active_sessions > 0 && (
                <div className="flex items-center mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1"></div>
                  <span className="text-xs text-green-600">Live</span>
                </div>
              )}
            </div>
            <Activity className="w-8 h-8 text-blue-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {statistics.committed_sessions}
              </div>
              <div className="text-sm text-gray-600">Sessions Committed</div>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {statistics.total_curators}
              </div>
              <div className="text-sm text-gray-600">Total Curators</div>
            </div>
            <Users className="w-8 h-8 text-purple-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {Math.round(statistics.avg_review_time_seconds)}s
              </div>
              <div className="text-sm text-gray-600">Avg Review Time</div>
            </div>
            <Clock className="w-8 h-8 text-orange-600 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Decision Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Decision Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Decisions</span>
              <Badge variant="outline">{statistics.total_decisions.toLocaleString()}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Proteins with Domains</span>
              <Badge variant="default" className="bg-green-600">
                {statistics.proteins_with_domains.toLocaleString()}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Fragments Identified</span>
              <Badge variant="secondary">{statistics.fragments_identified.toLocaleString()}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Repeat Proteins</span>
              <Badge variant="outline">{statistics.repeat_proteins.toLocaleString()}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Flagged for Review</span>
              <Badge variant="destructive">{statistics.flagged_for_review.toLocaleString()}</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Quality Metrics</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Average Confidence Level</span>
                <span className="font-medium">{statistics.avg_confidence_level.toFixed(1)}/5</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${(statistics.avg_confidence_level / 5) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Domain Detection Rate</span>
              <span className="font-medium text-green-600">
                {statistics.total_decisions > 0 
                  ? ((statistics.proteins_with_domains / statistics.total_decisions) * 100).toFixed(1)
                  : 0}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Review Quality</span>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">
                  {statistics.flagged_for_review > 0 && statistics.total_decisions > 0
                    ? (100 - (statistics.flagged_for_review / statistics.total_decisions) * 100).toFixed(1)
                    : 100}%
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        {recentActivity.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No recent curation activity
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium">{activity.curator_name}</div>
                    <div className="text-sm text-gray-600">
                      {activity.proteins_reviewed}/{activity.target_batch_size} proteins reviewed
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={
                      activity.status === 'committed' ? 'default' :
                      activity.status === 'in_progress' ? 'secondary' : 'outline'
                    }
                    className={
                      activity.status === 'committed' ? 'bg-green-600' :
                      activity.status === 'in_progress' ? 'bg-blue-600' : ''
                    }
                  >
                    {activity.status}
                  </Badge>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
