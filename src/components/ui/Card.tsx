'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn(
      'rounded-lg border border-gray-200 bg-white shadow-sm',
      className
    )}>
      {children}
    </div>
  )
}
