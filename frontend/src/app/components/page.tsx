'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Badge';
import { Activity, Zap, Database, TrendingUp } from 'lucide-react';

export default function ComponentsPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0F] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold text-[#E6E6EB] mb-3">RedEngine Components</h1>
          <p className="text-[#A1A1AA] text-lg">Design system showcase</p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Card 1 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#FF3B3B]" />
                Engine Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">The RedEngine is operational and ready for queries.</p>
              <div className="flex gap-2">
                <Badge variant="success">Active</Badge>
                <Badge variant="default">v0.0.1</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 2 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-[#FF3B3B]" />
                Data Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Efficient processing of large analytical datasets.</p>
              <div className="flex gap-2">
                <Badge variant="warning">Processing</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 3 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#FF3B3B]" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Real-time performance monitoring and optimization.</p>
              <div className="flex gap-2">
                <Badge variant="success">Optimized</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card 4 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#FF3B3B]" />
                Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Comprehensive analytics and insights dashboard.</p>
              <div className="flex gap-2">
                <Badge variant="success">Live</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Buttons Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-[#E6E6EB] mb-6">Buttons</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" size="sm">Small Primary</Button>
            <Button variant="primary" size="md">Medium Primary</Button>
            <Button variant="primary" size="lg">Large Primary</Button>
            <Button variant="secondary" size="sm">Small Secondary</Button>
            <Button variant="secondary" size="md">Medium Secondary</Button>
            <Button variant="secondary" size="lg">Large Secondary</Button>
          </div>
        </div>

        {/* Badges Section */}
        <div>
          <h2 className="text-2xl font-bold text-[#E6E6EB] mb-6">Status Badges</h2>
          <div className="flex flex-wrap gap-4">
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="error">Error</Badge>
            <Badge variant="default">Default</Badge>
          </div>
        </div>
      </div>
    </main>
  );
}
