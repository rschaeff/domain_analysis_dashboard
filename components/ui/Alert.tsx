'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface AlertProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'destructive' | 'warning' | 'success'
}

export function Alert({
  children,
  className,
  variant = 'default',
  ...props
}: AlertProps) {
  const variantStyles = {
    default: 'bg-gray-50 border-gray-200 text-gray-800',
    destructive: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    success: 'bg-green-50 border-green-200 text-green-800'
  }

  return (
    <div
      className={cn(
        'relative rounded-md border p-4',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface AlertTitleProps {
  children: React.ReactNode
  className?: string
}

export function AlertTitle({
  children,
  className,
  ...props
}: AlertTitleProps) {
  return (
    <h5
      className={cn(
        'font-medium leading-none tracking-tight mb-1',
        className
      )}
      {...props}
    >
      {children}
    </h5>
  )
}

interface AlertDescriptionProps {
  children: React.ReactNode
  className?: string
}

export function AlertDescription({
  children,
  className,
  ...props
}: AlertDescriptionProps) {
  return (
    <div
      className={cn(
        'text-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
