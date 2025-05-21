import './globals.css'
import '../components/visualization/molstar/styles/domain-visualization.css';
import { inter } from '@/lib/fonts'
import Link from 'next/link'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />

        {/* Molstar CSS fallbacks */}
        <link rel="stylesheet" href="/molstar.css" precedence="default" />
        <link rel="stylesheet" href="https://unpkg.com/molstar@3.44.0/build/viewer/molstar.css" precedence="default" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/molstar@3.44.0/build/viewer/molstar.css" precedence="default" />

        {/* Critical Molstar CSS */}
        <style dangerouslySetInnerHTML={{ __html: `
          .msp-plugin {
            position: relative;
            width: 100%;
            height: 100%;
          }
          .msp-canvas3d {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }
          .msp-viewport-controls {
            position: absolute;
            right: 10px;
            top: 10px;
          }
        `}} />
      </head>
      <body className={inter.className} suppressHydrationWarning={true}>
        <div className="min-h-screen bg-gray-50">
          {/* Improved Navigation */}
          <nav className="bg-white shadow-sm border-b border-gray-200">
            <div className="mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  {/* Brand */}
                  <Link href="/" className="flex items-center">
                    <span className="text-2xl font-bold text-blue-600">pyECOD</span>
                    <span className="ml-2 text-sm text-gray-500 hidden sm:block">
                      Protein Domain Analysis
                    </span>
                  </Link>

                  {/* Main Navigation */}
                  <div className="hidden md:ml-8 md:flex md:space-x-8">
                    <Link
                      href="/dashboard"
                      className="text-gray-900 hover:text-blue-600 px-3 py-2 text-sm font-medium border-b-2 border-blue-500"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/batches"
                      className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium border-b-2 border-transparent hover:border-gray-300"
                    >
                      Batches
                    </Link>
                    <Link
                      href="/analysis"
                      className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium border-b-2 border-transparent hover:border-gray-300"
                    >
                      Analysis Tools
                    </Link>
                  </div>
                </div>

                {/* Right side navigation */}
                <div className="flex items-center space-x-4">
                  <Link
                    href="/docs"
                    className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                  >
                    Documentation
                  </Link>
                  <Link
                    href="/settings"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          {/* Main Content with Better Width Management */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
