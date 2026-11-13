import type {Metadata} from 'next';
import {Cormorant_Garamond} from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Galantis Portfolio',
  description:
    'Interactive infinite 3D spherical photography portfolio for Galantis with omnidirectional panning, tactile zoom-out, and cinematic corner chromatic aberration.',
  openGraph: {
    title: 'Galantis Portfolio',
    description:
      'Interactive infinite 3D spherical photography portfolio for Galantis with omnidirectional panning, tactile zoom-out, and cinematic corner chromatic aberration.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galantis Portfolio',
    description:
      'Interactive infinite 3D spherical photography portfolio for Galantis with omnidirectional panning, tactile zoom-out, and cinematic corner chromatic aberration.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
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
