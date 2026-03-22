import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import ThemeProvider from '@/components/ThemeProvider'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Portfolio Performance',
  description: 'Track and evaluate your investment portfolio across stocks, cryptocurrencies, and other assets.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={montserrat.variable}>
      <body style={{ fontFamily: 'var(--font-sans)' }}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
