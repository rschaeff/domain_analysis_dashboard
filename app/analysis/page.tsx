'use client'

import React from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  Search,
  BarChart3,
  Download,
  FileText,
  Zap,
  Database,
  Eye,
  GitCompare,
  TrendingUp,
  Settings
} from 'lucide-react'

export default function AnalysisToolsPage() {
  const tools = [
    {
      id: 'domain-search',
      title: 'Domain Search',
      description: 'Search for domains by PDB ID, classification, or sequence properties',
      icon: Search,
      status: 'available',
      path: '/dashboard' // Links back to dashboard for now
    },
    {
      id: 'batch-comparison',
      title: 'Batch Comparison',
      description: 'Compare domain predictions across different processing batches',
      icon: GitCompare,
      status: 'coming-soon',
      path: null
    },
    {
      id: 'quality-metrics',
      title: 'Quality Metrics',
      description: 'Analyze prediction quality, confidence scores, and evidence coverage',
      icon: BarChart3,
      status: 'coming-soon',
      path: null
    },
    {
      id: 'export-tools',
      title: 'Data Export',
      description: 'Export domain data in various formats (CSV, JSON, FASTA)',
      icon: Download,
      status: 'available',
      path: '/dashboard' // Export functionality is in dashboard
    },
    {
      id: 'validation-reports',
      title: 'Validation Reports',
      description: 'Generate comprehensive validation reports against reference databases',
      icon: FileText,
      status: 'coming-soon',
      path: null
    },
    {
      id: 'pipeline-runner',
      title: 'Pipeline Runner',
      description: 'Run domain analysis pipeline on custom protein sets',
      icon: Zap,
      status: 'development',
      path: null
    },
    {
      id: 'sequence-browser',
      title: 'Sequence Browser',
      description: 'Browse protein sequences and their domain annotations',
      icon: Eye,
      status: 'coming-soon',
      path: null
    },
    {
      id: 'statistics',
      title: 'Statistics Dashboard',
      description: 'Detailed statistics and trends across all processed data',
      icon: TrendingUp,
      status: 'coming-soon',
      path: null
    },
    {
      id: 'reference-manager',
      title: 'Reference Manager',
      description: 'Manage reference databases and classification hierarchies',
      icon: Database,
      status: 'development',
      path: null
    }
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Available</span>
      case 'coming-soon':
        return <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Coming Soon</span>
      case 'development':
        return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">In Development</span>
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Unknown</span>
    }
  }

  const featuredWorkflows = [
    {
      title: "New Structure Analysis",
      description: "Complete workflow for analyzing newly deposited PDB structures",
      steps: ["Import Structure", "Run BLAST", "Generate Profiles", "Domain Prediction", "Classification"],
      estimatedTime: "15-30 minutes"
    },
    {
      title: "Batch Validation",
      description: "Validate domain predictions against known reference data",
      steps: ["Select Batch", "Choose References", "Run Comparison", "Generate Report"],
      estimatedTime: "5-10 minutes"
    },
    {
      title: "Custom Analysis",
      description: "Run analysis on user-provided protein sequences",
      steps: ["Upload Sequences", "Configure Pipeline", "Execute Analysis", "Review Results"],
      estimatedTime: "Variable"
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analysis Tools</h1>
              <p className="text-gray-600 mt-1">
                Comprehensive tools for protein domain analysis and data exploration
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button>
                <FileText className="w-4 h-4 mr-2" />
                Documentation
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="text-2xl font-bold text-green-600">2</div>
              <div className="text-sm text-gray-600">Available Tools</div>
            </Card>
            <Card className="p-6">
              <div className="text-2xl font-bold text-blue-600">5</div>
              <div className="text-sm text-gray-600">Coming Soon</div>
            </Card>
            <Card className="p-6">
              <div className="text-2xl font-bold text-yellow-600">2</div>
              <div className="text-sm text-gray-600">In Development</div>
            </Card>
            <Card className="p-6">
              <div className="text-2xl font-bold text-purple-600">3</div>
              <div className="text-sm text-gray-600">Workflows</div>
            </Card>
          </div>

          {/* Featured Workflows */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Featured Workflows</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {featuredWorkflows.map((workflow, index) => (
                <Card key={index} className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{workflow.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{workflow.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="text-sm font-medium text-gray-700">Steps:</div>
                    <ol className="text-sm text-gray-600 space-y-1">
                      {workflow.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-center">
                          <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full text-xs flex items-center justify-center mr-2 flex-shrink-0">
                            {stepIndex + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">~{workflow.estimatedTime}</span>
                    <Button size="sm" variant="outline" disabled>
                      Coming Soon
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Analysis Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tools.map((tool) => {
                const IconComponent = tool.icon
                const isAvailable = tool.status === 'available'
                
                const cardContent = (
                  <Card className={`p-6 transition-all duration-200 ${isAvailable ? 'hover:shadow-md cursor-pointer' : 'opacity-75'}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-lg ${isAvailable ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <IconComponent className={`w-6 h-6 ${isAvailable ? 'text-blue-600' : 'text-gray-400'}`} />
                      </div>
                      {getStatusBadge(tool.status)}
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{tool.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{tool.description}</p>
                    
                    <Button 
                      size="sm" 
                      variant={isAvailable ? "default" : "outline"}
                      disabled={!isAvailable}
                      className="w-full"
                    >
                      {isAvailable ? 'Launch Tool' : 'Coming Soon'}
                    </Button>
                  </Card>
                )

                return isAvailable && tool.path ? (
                  <Link key={tool.id} href={tool.path}>
                    {cardContent}
                  </Link>
                ) : (
                  <div key={tool.id}>
                    {cardContent}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Coming Soon Notice */}
          <Card className="p-8 text-center bg-blue-50 border-blue-200">
            <Zap className="w-16 h-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              More Tools Coming Soon
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We're actively developing additional analysis tools and workflows. 
              Check back regularly for new features, or contact us if you have 
              specific analysis requirements.
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Button variant="outline">
                <FileText className="w-4 h-4 mr-2" />
                Request Feature
              </Button>
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                View Roadmap
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
