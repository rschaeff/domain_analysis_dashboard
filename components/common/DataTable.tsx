'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp, ChevronDown } from 'lucide-react'
import { PaginationParams } from '@/lib/types'

interface Column<T = any> {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, item: T) => React.ReactNode
  width?: string
}

interface DataTableProps<T = any> {
  data: T[]
  columns: Column<T>[]
  pagination?: PaginationParams
  onPageChange?: (page: number) => void
  onRowClick?: (item: T) => void
  loading?: boolean
  className?: string
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pagination,
  onPageChange,
  onRowClick,
  loading = false,
  className = ''
}: DataTableProps<T>) {
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // Handle sorting
  const handleSort = (columnKey: string) => {
    if (sortField === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(columnKey)
      setSortDirection('asc')
    }
  }

  // Sort data if needed
  const sortedData = React.useMemo(() => {
    if (!sortField) return data

    return [...data].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      let comparison = 0
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue)
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue
      } else {
        comparison = String(aValue).localeCompare(String(bValue))
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [data, sortField, sortDirection])

  // Pagination calculations
  const currentPage = pagination?.page || 1
  const pageSize = pagination?.size || 50
  const totalItems = pagination?.total || data.length
  const totalPages = Math.ceil(totalItems / pageSize)

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  // Generate pagination range
  const getPaginationRange = () => {
    const range = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        range.push(i)
      }
    } else {
      const start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
      const end = Math.min(totalPages, start + maxVisible - 1)

      for (let i = start; i <= end; i++) {
        range.push(i)
      }
    }

    return range
  }

  const pageRange = getPaginationRange()

  if (loading) {
    return (
      <div className="border rounded-lg">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg bg-white ${className}`}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-full table-auto">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`text-left px-6 py-4 text-sm font-medium text-gray-700 whitespace-nowrap ${
                    column.width ? `w-[${column.width}]` : ''
                  } ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && (
                      <div className="flex flex-col">
                        {sortField === column.key ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )
                        ) : (
                          <div className="text-gray-400">
                            <ChevronUp className="w-3 h-3 -mb-1" />
                            <ChevronDown className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              sortedData.map((item, index) => (
                <tr
                  key={item.id || index}
                  className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                      {column.render
                        ? column.render(item[column.key], item)
                        : item[column.key] || '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="text-sm text-gray-700">
            Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of{' '}
            {totalItems.toLocaleString()} results
          </div>

          <div className="flex items-center gap-2">
            {/* First page */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>

            {/* Previous page */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Page numbers */}
            {pageRange.map((pageNum) => (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange?.(pageNum)}
              >
                {pageNum}
              </Button>
            ))}

            {/* Next page */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            {/* Last page */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
