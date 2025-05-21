'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  children: React.ReactNode
  content: React.ReactNode
  className?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delayDuration?: number
}

export function Tooltip({
  children,
  content,
  className,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  ...props
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Update tooltip position when it becomes visible
  useEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      
      let top = 0
      let left = 0

      // Position based on side
      switch (side) {
        case 'top':
          top = -tooltipRect.height - 8
          break
        case 'bottom':
          top = triggerRect.height + 8
          break
        case 'left':
          left = -tooltipRect.width - 8
          top = (triggerRect.height - tooltipRect.height) / 2
          break
        case 'right':
          left = triggerRect.width + 8
          top = (triggerRect.height - tooltipRect.height) / 2
          break
      }

      // Adjust alignment
      if ((side === 'top' || side === 'bottom') && align !== 'center') {
        if (align === 'start') {
          left = 0
        } else if (align === 'end') {
          left = triggerRect.width - tooltipRect.width
        } else {
          left = (triggerRect.width - tooltipRect.width) / 2
        }
      }

      if ((side === 'left' || side === 'right') && align !== 'center') {
        if (align === 'start') {
          top = 0
        } else if (align === 'end') {
          top = triggerRect.height - tooltipRect.height
        }
      }

      setPosition({ top, left })
    }
  }, [isVisible, side, align])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delayDuration)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 100)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Map side to arrow positioning classes
  const sideToArrowClass = {
    top: 'after:bottom-[calc(100%-5px)] after:left-1/2 after:-translate-x-1/2 after:border-t-gray-800',
    bottom: 'after:top-[calc(100%-5px)] after:left-1/2 after:-translate-x-1/2 after:border-b-gray-800',
    left: 'after:right-[calc(100%-5px)] after:top-1/2 after:-translate-y-1/2 after:border-l-gray-800',
    right: 'after:left-[calc(100%-5px)] after:top-1/2 after:-translate-y-1/2 after:border-r-gray-800'
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
      {...props}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
          className={cn(
            'absolute z-50 px-3 py-2 text-xs text-white bg-gray-800 rounded-md shadow-md',
            'opacity-0 transition-opacity duration-200',
            isVisible && 'opacity-100',
            // Arrow styling
            'after:absolute after:block after:w-0 after:h-0',
            'after:border-4 after:border-transparent',
            sideToArrowClass[side],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  )
}
