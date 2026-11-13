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
  title: 'Galantis | Fotografia Profissional',
  description:
    'Portfólio fotográfico de Julio Aparecido de Oliveira (Galantis). Fotografia de ensaios, retratos, eventos e sessões especiais.',
  openGraph: {
    title: 'Galantis | Fotografia Profissional',
    description:
      'Portfólio fotográfico de Julio Aparecido de Oliveira (Galantis). Fotografia de ensaios, retratos, eventos e sessões especiais.',
    type: 'website',
    images: [
      {
        url: '/logo/logo.png',
        width: 800,
        height: 600,
        alt: 'Galantis Fotografia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galantis | Fotografia Profissional',
    description:
      'Portfólio fotográfico de Julio Aparecido de Oliveira (Galantis). Ensaios, retratos e sessões especiais.',
    images: ['/logo/logo.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cormorant.variable} dark`}>
      <body
        suppressHydrationWarning
        className="bg-black text-white antialiased overflow-hidden select-none m-0 p-0"
      >
        {children}
      </body>
    </html>
  );
}
