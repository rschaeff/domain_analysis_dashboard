import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Helper function to handle database connection errors
export async function connectToDatabase() {
  try {
    await prisma.$connect()
    console.log('Database connected successfully')
  } catch (error) {
    console.error('Failed to connect to database:', error)
    throw error
  }
}

// Graceful shutdown
export async function disconnectFromDatabase() {
  await prisma.$disconnect()
}

// Database helper functions
export async function executeRawQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
  try {
    return await prisma.$queryRawUnsafe(query, ...(params || []))
  } catch (error) {
    console.error('Raw query error:', error)
    throw error
  }
}

// Transaction helper
export async function executeTransaction<T>(
  callback: (prisma: PrismaClient) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(callback)
}
