'use client'

import React from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  Database, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Play,
  Pause,
  MoreHorizontal
} from 'lucide-react'

export default function BatchesPage() {
  // Mock data for demonstration
  const batches = [
    {
      id: 123,
      name: "PDB Update 2024-01",
      status: "completed",
      created: "2024-01-15",
      proteins: 1226,
      domains: 2438,
      progress: 100
    },
    {
      id: 124,
      name: "Manual Curation Set A",
      status: "running", 
      created: "2024-01-20",
      proteins: 450,
      domains: 892,
      progress: 73
    },
    {
      id: 125,
      name: "Validation Dataset",
      status: "pending",
      created: "2024-01-22",
      proteins: 0,
      domains: 0,
      progress: 0
    }
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'running':
        return <Play className="w-5 h-5 text-blue-600" />
      case 'pending':
        return <Pause className="w-5 h-5 text-gray-600" />
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'pending':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Processing Batches</h1>
              <p className="text-gray-600 mt-1">
                Manage and monitor domain analysis processing batches
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Database className="w-4 h-4 mr-2" />
                Import Batch
              </Button>
              <Button>
                <Play className="w-4 h-4 mr-2" />
                New Batch
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="text-2xl font-bold text-blue-600">3</div>
              <div className="text-sm text-gray-600">Total Batches</div>
            </Card>
            <Card className="p-6">
              <div className="text-2xl font-bold text-green-600">1</div>
              <div className="text-sm text-gray-600">Completed</div>
            </Card>
            <Card className="p-6">
              <div className="text-2xl font-bold text-blue-600">1</div>
              <div className="text-sm text-gray-600">Running</div>
            </Card>
            <Card className="p-6">
              <div className="text-2xl font-bold text-gray-600">1</div>
              <div className="text-sm text-gray-600">Pending</div>
            </Card>
          </div>

          {/* Batches List */}
          <Card>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Recent Batches</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {batches.map((batch) => (
                <div key={batch.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(batch.status)}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {batch.name}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                          <span>Batch #{batch.id}</span>
                          <span className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            Created {batch.created}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      {/* Stats */}
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {batch.proteins.toLocaleString()} proteins
                        </div>
                        <div className="text-sm text-gray-500">
                          {batch.domains.toLocaleString()} domains
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}>
                        {batch.status}
                      </span>
                      
                      {/* Progress Bar */}
                      {batch.status === 'running' && (
                        <div className="w-32">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{batch.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${batch.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {/* Actions */}
                      <Button variant="outline" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Coming Soon Notice */}
          <Card className="p-8 text-center bg-blue-50 border-blue-200">
            <Database className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Batch Management Coming Soon
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              This page will provide comprehensive batch management capabilities including 
              batch creation, monitoring, status tracking, and results analysis. 
              Currently showing mock data for layout demonstration.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
