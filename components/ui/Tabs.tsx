'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'

interface TabsProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className
}: TabsProps) {
  // Handle both controlled and uncontrolled modes
  const [internalValue, setInternalValue] = useState(defaultValue || value || '')

  // If value is provided, component is controlled
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const handleValueChange = (newValue: string) => {
    // For uncontrolled mode, update internal state
    if (!isControlled) {
      setInternalValue(newValue)
    }
    // Call external handler if provided
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  // Creating a context for each Tabs component instance
  const contextValue = React.useMemo(() => ({
    value: currentValue,
    onValueChange: handleValueChange
  }), [currentValue, handleValueChange])

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabsListProps {
  className?: string
  children: React.ReactNode
}

export function TabsList({
  className,
  children
}: TabsListProps) {
  return (
    <div className={cn('flex items-center p-1 bg-gray-100 rounded-md', className)}>
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function TabsTrigger({
  value,
  children,
  className,
  onClick
}: TabsTriggerProps) {
  const context = React.useContext(TabsContext)

  if (!context) {
    console.error('TabsTrigger must be used within a Tabs component')
    return null
  }

  const handleClick = () => {
    context.onValueChange(value)
    if (onClick) onClick()
  }

  const isActive = context.value === value

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex-1 py-2 px-3 text-sm font-medium text-center transition-colors rounded-sm',
        isActive
          ? 'bg-white shadow-sm text-gray-900'
          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50',
        className
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({
  value,
  children,
  className
}: TabsContentProps) {
  const context = React.useContext(TabsContext)

  if (!context) {
    console.error('TabsContent must be used within a Tabs component')
    return null
  }

  if (context.value !== value) {
    return null
  }

  return (
    <div className={cn('mt-4', className)}>
      {children}
    </div>
  )
}

// Create a context to share the active tab value
interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue | undefined>(undefined)

// Export for testing
export { TabsContext }
