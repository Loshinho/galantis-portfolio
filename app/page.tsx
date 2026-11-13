'use client';

import React, { useState } from 'react';
import GalantisHeader from '@/components/GalantisHeader';
import InfinitePortfolioCanvas from '@/components/InfinitePortfolioCanvas';

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
      <GalantisHeader
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((prev) => !prev)}
      />
      <InfinitePortfolioCanvas menuOpen={menuOpen} />
    </main>
  );
}
