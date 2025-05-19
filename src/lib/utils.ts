import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatConfidence(confidence: number | null): string {
  if (confidence === null || confidence === undefined) return 'N/A'
  return confidence.toFixed(3)
}

export function formatRange(start: number, end: number): string {
  return `${start}-${end}`
}

export function calculateDomainLength(start: number, end: number): number {
  return end - start + 1
}

export function getConfidenceLevel(confidence: number | null): 'high' | 'medium' | 'low' | 'none' {
  if (!confidence) return 'none'
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}

export function getOverlapType(
  putativeStart: number,
  putativeEnd: number,
  referenceStart: number,
  referenceEnd: number
): 'none' | 'exact' | 'partial' | 'conflict' {
  const overlapStart = Math.max(putativeStart, referenceStart)
  const overlapEnd = Math.min(putativeEnd, referenceEnd)
  
  if (overlapStart > overlapEnd) return 'none'
  
  const overlapLength = overlapEnd - overlapStart + 1
  const putativeLength = putativeEnd - putativeStart + 1
  const referenceLength = referenceEnd - referenceStart + 1
  
  if (overlapLength === putativeLength && overlapLength === referenceLength) {
    return 'exact'
  } else if (overlapLength / Math.min(putativeLength, referenceLength) > 0.8) {
    return 'partial'
  } else {
    return 'conflict'
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

export function downloadAsCSV(data: any[], filename: string) {
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(key => {
        const value = row[key]
        // Handle values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }).join(',')
    )
  ].join('\n')
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function validatePDBId(pdbId: string): boolean {
  // PDB IDs are 4 characters: digit followed by 3 alphanumeric
  const pdbRegex = /^[0-9][A-Za-z0-9]{3}$/
  return pdbRegex.test(pdbId)
}

export function validateChainId(chainId: string): boolean {
  // Chain IDs can be a single letter or alphanumeric
  const chainRegex = /^[A-Za-z0-9]$/
  return chainRegex.test(chainId)
}
