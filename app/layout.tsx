import type { Metadata } from 'next';
import { Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://galantis.online'),
  title: 'Galantis Fotografias',
  description: 'Portfólio Galantis. Fotografia de ensaios, eventos e sessões especiais.',
  icons: {
    icon: '/logo/iconpage.png',
    shortcut: '/logo/iconpage.png',
    apple: '/logo/iconpage.png',
  },
  openGraph: {
    title: 'Galantis Fotografias',
    description: 'Portfólio Galantis. Fotografia de ensaios, eventos e sessões especiais.',
    type: 'website',
    images: [
      {
        url: '/logo/preview.jpg',
        width: 1200,
        height: 630,
        alt: 'Galantis Fotografias',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galantis Fotografias',
    description: 'Portfólio Galantis. Fotografia de ensaios, eventos e sessões especiais.',
    images: ['/logo/preview.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} dark`}>
      <head>
        <link rel="icon" href="/logo/iconpage.png" sizes="any" />
        <link rel="apple-touch-icon" href="/logo/iconpage.png" />
      </head>
      <body
        suppressHydrationWarning
        className="bg-black text-white antialiased overflow-hidden select-none m-0 p-0"
      >
        {children}
      </body>
    </html>
  );
}
