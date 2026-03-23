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
  title: 'Apna Stocks',
  description: 'Apna Stocks — track and analyse your Indian stock portfolio. Your portfolio, your control.',
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
