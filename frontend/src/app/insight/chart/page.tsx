import nextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';

const InsightClient = nextDynamic(() => import('../InsightClient'), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-[#0B0B0F] flex items-center justify-center">
      <div className="text-[#A1A1AA]">Loading...</div>
    </div>
  ),
});

export default function Page() {
  return <InsightClient />;
}
