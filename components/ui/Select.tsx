'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, X, Check } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  options: SelectOption[]
  value?: string | string[]
  onChange: (value: string | string[]) => void
  placeholder?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  error?: string
  search?: boolean
}

export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  multiple = false,
  disabled = false,
  className = '',
  error,
  search = false
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const selectRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && search && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen, search])

  // Filter options based on search term
  const filteredOptions = React.useMemo(() => {
    if (!search || !searchTerm) return options
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.value.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [options, search, searchTerm])

  // Get selected values as array
  const selectedValues = multiple ? (value as string[]) || [] : value ? [value as string] : []

  // Get display text
  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder

    if (multiple) {
      if (selectedValues.length === 1) {
        const option = options.find(opt => opt.value === selectedValues[0])
        return option?.label || selectedValues[0]
      }
      return `${selectedValues.length} selected`
    }

    const option = options.find(opt => opt.value === selectedValues[0])
    return option?.label || selectedValues[0]
  }

  // Handle option selection
  const handleOptionClick = (optionValue: string) => {
    if (multiple) {
      const newValue = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue]
      onChange(newValue)
    } else {
      onChange(optionValue)
      setIsOpen(false)
      setSearchTerm('')
    }
  }

  // Handle removing a selected item (multiple mode)
  const handleRemoveItem = (valueToRemove: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (multiple) {
      const newValue = selectedValues.filter(v => v !== valueToRemove)
      onChange(newValue)
    }
  }

  return (
    <div className="relative" ref={selectRef}>
      {/* Select trigger */}
      <div
        className={cn(
          'flex items-center justify-between w-full h-10 px-3 py-2 text-sm bg-white border border-gray-300 rounded-md cursor-pointer transition-colors',
          'hover:border-gray-400 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-60',
          error && 'border-red-500',
          isOpen && 'ring-2 ring-blue-500 border-blue-500',
          className
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex-1 flex items-center gap-1 min-w-0">
          {multiple && selectedValues.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedValues.map(val => {
                const option = options.find(opt => opt.value === val)
                return (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs"
                  >
                    {option?.label || val}
                    <button
                      className="hover:text-blue-900"
                      onClick={(e) => handleRemoveItem(val, e)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          ) : (
            <span className={selectedValues.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
              {getDisplayText()}
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-400 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
          {/* Search input */}
          {search && (
            <div className="p-2 border-b">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search options..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Options list */}
          <div className="max-h-60 overflow-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {search && searchTerm ? 'No options found' : 'No options available'}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors',
                      isSelected 
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-900 hover:bg-gray-100',
                      option.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                    onClick={() => !option.disabled && handleOptionClick(option.value)}
                  >
                    {multiple && (
                      <div className={cn(
                        'w-4 h-4 border rounded flex items-center justify-center',
                        isSelected 
                          ? 'bg-blue-600 border-blue-600 text-white' 
                          : 'border-gray-300'
                      )}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    )}
                    <span className="flex-1">{option.label}</span>
                    {!multiple && isSelected && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Selected count for multiple */}
          {multiple && selectedValues.length > 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 border-t bg-gray-50">
              {selectedValues.length} of {options.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  )
}
