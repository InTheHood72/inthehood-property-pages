'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import ScrollToTop from '../app/components/scroll-to-top'

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="class" enableSystem={false} defaultTheme="light">
                {children}
                <ScrollToTop />
            </ThemeProvider>
        </SessionProvider>
    )
}
