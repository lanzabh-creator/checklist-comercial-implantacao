import type { Metadata } from 'next'
export const metadata: Metadata = {
  title: 'Teknisa — Intelligence Comercial',
  description: 'Sistema de diagnóstico e geração de relatórios comerciais estratégicos Teknisa',
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
