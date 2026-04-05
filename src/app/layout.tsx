import type { Metadata, Viewport } from 'next'
import TabBar from '@/components/layout/TabBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'NextStop',
  description: 'Plan your Translink journey across Northern Ireland',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NextStop',
  },
}

export const viewport: Viewport = {
  themeColor: '#006565',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-surface font-body antialiased">
        {children}
        <TabBar />
        {/* Ambient background glows */}
        <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
          <div className="absolute bottom-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-secondary/5 blur-[120px]" />
        </div>
      </body>
    </html>
  )
}
