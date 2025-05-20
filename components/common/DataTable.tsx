'use client'

import React from 'react'
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
  console.log('🔍 Minimal DataTable - data received:', data.length, 'items')
  console.log('🔍 First item:', data[0])

  if (loading) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className={`border-2 border-red-500 rounded-lg bg-white ${className}`}>
      {/* Large debug header */}
      <div className="p-4 bg-red-100 border-b-2 border-red-500">
        <h3 className="text-lg font-bold text-red-800">
          🔍 MINIMAL DATATABLE DEBUG - {data.length} items
        </h3>
        <p className="text-sm text-red-600">
          First item PDB: {data[0]?.pdb_id}, Chain: {data[0]?.chain_id}
        </p>
      </div>

      {/* Super simple table */}
      <div className="p-4">
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    border: '1px solid #d1d5db',
                    fontWeight: 'bold'
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((item, index) => (
              <tr
                key={item.id || index}
                style={{
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                  border: '1px solid #d1d5db'
                }}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '12px',
                      border: '1px solid #d1d5db'
                    }}
                  >
                    {col.render
                      ? col.render(item[col.key], item)
                      : String(item[col.key] || '-')
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Show raw data for debugging */}
      <div className="p-4 bg-gray-50 border-t">
        <details>
          <summary className="cursor-pointer font-medium">🔍 Show Raw Data (First Item)</summary>
          <pre className="mt-2 text-xs bg-white p-2 border rounded overflow-auto">
            {JSON.stringify(data[0], null, 2)}
          </pre>
        </details>
      </div>
    </div>
  )
}
