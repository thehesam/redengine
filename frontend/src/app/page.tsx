'use client';

import Link from 'next/link';
import { Button } from '@/components/Button';

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center bg-[#0B0B0F] p-4 sm:p-8">
      <div className="text-center">
        {/* Main heading with RedEngine text */}
        <h1 className="text-5xl sm:text-7xl md:text-9xl font-bold mb-6 sm:mb-8 tracking-tighter">
          <span className="bg-gradient-to-r from-[#FF3B3B] to-[#FF5555] bg-clip-text text-transparent">
            🔴RedEngine
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-[#A1A1AA] text-base sm:text-xl mb-8 sm:mb-12 max-w-2xl mx-auto px-4">
          Mine Reddit communities for pain points, trends, and hidden signals
        </p>

        {/* Status indicator */}
        <div className="flex items-center justify-center gap-3 mb-8 sm:mb-12">
          <div className="w-3 h-3 bg-[#22C55E] rounded-full animate-pulse"></div>
          <p className="text-sm text-[#A1A1AA]">Ready to process</p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
          <Button variant="primary" size="lg" disabled className="opacity-40 cursor-not-allowed hover:bg-[#FF3B3B]">
            Start Collecting
          </Button>
          <Link href="/insight">
            <Button variant="secondary" size="lg">
              View Insights
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
