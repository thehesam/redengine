'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, Layers, MessageCircle, TrendingUp, Sparkles, Eye, EyeOff, Target, Edit2, X, Info, AlertCircle, Search, Trash2, Undo2, Redo2, Menu } from 'lucide-react';
import { Chart as ChartJS, ScatterController, LineController, LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Legend, ChartOptions } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Chart } from 'react-chartjs-2';

// 3D Embedding scatter chart using Plotly (dynamically imported to avoid SSR)
function EmbeddingChart3D({ points }: { points: Array<{ x: number; y: number; z: number; title: string; ups?: number; comments?: number }> }) {
  const [PlotComponent, setPlotComponent] = useState<any>(null);

  useEffect(() => {
    import('react-plotly.js').then(mod => setPlotComponent(() => mod.default));
  }, []);

  if (!PlotComponent || points.length === 0) return null;

  const trace = {
    type: 'scatter3d' as const,
    mode: 'markers' as const,
    x: points.map(p => p.x),
    y: points.map(p => p.y),
    z: points.map(p => p.z),
    text: points.map(p =>
      [
        p.title,
        p.ups !== undefined ? `↑ ${p.ups}` : null,
        p.comments !== undefined ? `💬 ${p.comments}` : null,
      ]
        .filter(Boolean)
        .join('<br>')
    ),
    hoverinfo: 'text' as const,
    hoverlabel: {
      bgcolor: '#18181F',
      bordercolor: '#2A2A33',
      font: { color: '#E6E6EB', size: 12, family: 'inherit' },
    },
    marker: {
      size: 4,
      color: 'rgba(156,39,176,0.6)',
      line: { width: 0 },
    },
  };

  const axisStyle = {
    gridcolor: '#2A2A33',
    zerolinecolor: '#2A2A33',
    tickfont: { color: '#A1A1AA', size: 10 },
    backgroundcolor: '#18181F',
    showbackground: true,
  };

  const layout = {
    paper_bgcolor: '#18181F',
    plot_bgcolor: '#18181F',
    margin: { l: 0, r: 0, t: 0, b: 0 },
    scene: {
      bgcolor: '#18181F',
      xaxis: axisStyle,
      yaxis: axisStyle,
      zaxis: axisStyle,
      camera: { eye: { x: 1.4, y: 1.4, z: 1.4 } },
    },
    showlegend: false,
  };

  const config = {
    displayModeBar: false,
    responsive: true,
  };

  return (
    <PlotComponent
      data={[trace]}
      layout={layout}
      config={config}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  );
}

export default function InsightPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = pathname === '/insight/chart' ? 'chart' : 'overview';
  const chartSubreddit = searchParams.get('subreddit');
  const chartQuery = searchParams.get('query');
  const chartQueryType = searchParams.get('type') as 'exact' | 'semantic' | null;
  const [pluginsRegistered, setPluginsRegistered] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subreddits, setSubreddits] = useState<string[]>([]);
  const [selectedSubreddit, setSelectedSubreddit] = useState<string | null>(chartSubreddit);
  const [isLoadingSubreddits, setIsLoadingSubreddits] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    subreddits: false,
    groups: false,
    metrics: false,
    clustering: false,
    search: false,
  });

  // Subreddit Groups state
  const [subredditGroups, setSubredditGroups] = useState<Array<{ id: string; name: string; subreddits: string[] }>>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupSubreddits, setNewGroupSubreddits] = useState<Set<string>>(new Set());
  const [selectedSubredditGroup, setSelectedSubredditGroup] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<'ai' | 'pain' | 'advice' | 'narrative'>('ai');
  const [selectedColorMetric, setSelectedColorMetric] = useState<'none' | 'comments' | 'ups' | 'date' | 'upvote_ratio'>('none');
  const [normalizedColorValues, setNormalizedColorValues] = useState<number[]>([]);
  const [highlightTag, setHighlightTag] = useState<Set<string>>(new Set());
  const [chartData, setChartData] = useState<any>(null);
  const [chartDataUnfiltered, setChartDataUnfiltered] = useState<any>(null);
  const [isLoadingChart, setIsLoadingChart] = useState(false);
  const [numClusters, setNumClusters] = useState(3);
  const [clusterAssignments, setClusterAssignments] = useState<Record<string, number>>({});
  const [isClusteringLoading, setIsClusteringLoading] = useState(false);
  const [embeddingPoints, setEmbeddingPoints] = useState<any[]>([]);
  const [groupSortBy, setGroupSortBy] = useState<'posts' | 'comments' | 'ups'>('posts');
  const [clusterNames, setClusterNames] = useState<Record<string, string>>({});
  const [isNamingClusters, setIsNamingClusters] = useState(false);
  const [manualClusterNames, setManualClusterNames] = useState<Record<string, string>>({});
  const [groupOverviews, setGroupOverviews] = useState<Record<string, string>>({});

  const [hiddenClusters, setHiddenClusters] = useState<Set<string>>(new Set());
  const [focusedCluster, setFocusedCluster] = useState<string | null>(null);
  const [highlightedClusters, setHighlightedClusters] = useState<Set<string>>(new Set());
  const [editingCluster, setEditingCluster] = useState<string | null>(null);
  const [isDetectingK, setIsDetectingK] = useState(false);
  const [detectedK, setDetectedK] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [isLoadingPostDetails, setIsLoadingPostDetails] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupModalTab, setGroupModalTab] = useState<'overview' | 'posts'>('overview');
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuPoint, setContextMenuPoint] = useState<any>(null);
  
  // Undo/Redo state
  const [undoStack, setUndoStack] = useState<Array<{ embeddingPoints: any[]; clusterAssignments: Record<string, number>; chartData: any }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ embeddingPoints: any[]; clusterAssignments: Record<string, number>; chartData: any }>>([]);
  
  // Overview tab state
  const [overviewData, setOverviewData] = useState<any>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [postsOverTimeData, setPostsOverTimeData] = useState<any>(null);
  const [entityTrendData, setEntityTrendData] = useState<any>(null);
  const [topEntitiesData, setTopEntitiesData] = useState<Array<{ name: string; count: number }>>([]);
  const [topPlatformsData, setTopPlatformsData] = useState<Array<{ platform: string; count: number }>>([]);
  const [entityCooccurrenceData, setEntityCooccurrenceData] = useState<Array<{ a: string; b: string; count: number }>>([]);
  const [overviewEmbeddingData, setOverviewEmbeddingData] = useState<any>(null);
  const [overviewEmbeddingPoints, setOverviewEmbeddingPoints] = useState<any[]>([]);
  const [isLoadingOverviewEmbeddings, setIsLoadingOverviewEmbeddings] = useState(false);
  const [overview3DPoints, setOverview3DPoints] = useState<any[]>([]);
  const [isLoading3D, setIsLoading3D] = useState(false);
  const [overviewTimelineEnabled, setOverviewTimelineEnabled] = useState(false);
  const [overviewTimelinePos, setOverviewTimelinePos] = useState(50);
  const [overviewTimelineBounds, setOverviewTimelineBounds] = useState<{ min: number; max: number; dates: string[] } | null>(null);
  
  // Search state
  const [searchType, setSearchType] = useState<'exact' | 'semantic'>(chartQueryType || 'exact');
  const [searchQuery, setSearchQuery] = useState<string>(chartQuery || '');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedPostIds, setHighlightedPostIds] = useState<Set<string>>(new Set());
  const [queryPosition, setQueryPosition] = useState<{ x: number; y: number } | null>(null);
  const [displayedResultsCount, setDisplayedResultsCount] = useState(10);
  const chartRef = useRef(null);

  // Timeline slider state
  const [timelineEnabled, setTimelineEnabled] = useState(false);
  const [timelinePos, setTimelinePos] = useState(50); // 0-100 position along the date axis
  const [timelineBounds, setTimelineBounds] = useState<{ min: number; max: number; dates: string[] } | null>(null); // unix ms

  // Normalize values to 0-1 range (min-max scaling)
  const normalizeValues = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return values.map(() => 0.5);
    return values.map(v => (v - min) / (max - min));
  };

  // Get color based on normalized value (0-1)
  // Vary the opacity of the dot's own metric color based on the normalized intensity value (0.15 = low, 0.95 = high)
  const getColorForIntensity = (normalizedValue: number, baseMetricColor: string) => {
    const match = baseMetricColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return baseMetricColor;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const alpha = 0.15 + normalizedValue * 0.8;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // K-means clustering algorithm
  const kmeansCluster = (points: any[], k: number) => {
    if (points.length === 0 || k <= 0) return {};
    
    // Initialize random centers
    const centers = Array.from({ length: Math.min(k, points.length) }, () => ({
      x: points[Math.floor(Math.random() * points.length)].x,
      y: points[Math.floor(Math.random() * points.length)].y,
    }));

    const assignments: Record<string, number> = {};
    let converged = false;
    let iterations = 0;
    const maxIterations = 100;

    while (!converged && iterations < maxIterations) {
      // Assign points to nearest center
      const newAssignments: Record<string, number> = {};
      const clusterPoints: any[][] = Array.from({ length: centers.length }, () => []);

      points.forEach((point) => {
        let minDist = Infinity;
        let closestCenter = 0;

        centers.forEach((center, idx) => {
          const dist = Math.sqrt(Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2));
          if (dist < minDist) {
            minDist = dist;
            closestCenter = idx;
          }
        });

        newAssignments[point.post_id] = closestCenter;
        clusterPoints[closestCenter].push(point);
      });

      // Check convergence
      converged = JSON.stringify(assignments) === JSON.stringify(newAssignments);
      Object.assign(assignments, newAssignments);

      // Update centers
      centers.forEach((center, idx) => {
        if (clusterPoints[idx].length > 0) {
          const sumX = clusterPoints[idx].reduce((sum, p) => sum + p.x, 0);
          const sumY = clusterPoints[idx].reduce((sum, p) => sum + p.y, 0);
          center.x = sumX / clusterPoints[idx].length;
          center.y = sumY / clusterPoints[idx].length;
        }
      });

      iterations++;
    }

    return assignments;
  };

  // Calculate within-cluster sum of squares
  const calculateWCSS = (points: any[], assignments: Record<string, number>) => {
    let wcss = 0;
    const clusters: Record<number, any[]> = {};

    // Group points by cluster
    points.forEach((point) => {
      const clusterId = assignments[point.post_id];
      if (clusterId !== undefined) {
        if (!clusters[clusterId]) clusters[clusterId] = [];
        clusters[clusterId].push(point);
      }
    });

    // Calculate sum of squared distances from cluster center
    Object.values(clusters).forEach((clusterPoints) => {
      if (clusterPoints.length === 0) return;
      const centerX = clusterPoints.reduce((sum, p) => sum + p.x, 0) / clusterPoints.length;
      const centerY = clusterPoints.reduce((sum, p) => sum + p.y, 0) / clusterPoints.length;
      clusterPoints.forEach((point) => {
        const dist = Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2);
        wcss += dist;
      });
    });

    return wcss;
  };

  // Gap Statistic for optimal K detection
  const gapStatisticOptimalK = (points: any[], maxK: number = 10, numReferences: number = 10) => {
    if (points.length === 0) return 3;

    const gaps: number[] = [];
    const wcssValues: number[] = [];

    // Find bounding box for random data generation
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));

    // Test each K from 1 to maxK
    for (let k = 1; k <= maxK; k++) {
      // Get clustering for actual data
      const assignments = kmeansCluster(points, k);
      const wcss = calculateWCSS(points, assignments);
      wcssValues.push(wcss);

      // Generate random reference data and measure its WCSS
      let refWcssSum = 0;
      for (let ref = 0; ref < numReferences; ref++) {
        const randomPoints = Array.from({ length: points.length }, () => ({
          post_id: `random_${ref}_${Math.random()}`,
          x: minX + Math.random() * (maxX - minX),
          y: minY + Math.random() * (maxY - minY),
        }));

        const refAssignments = kmeansCluster(randomPoints, k);
        const refWcss = calculateWCSS(randomPoints, refAssignments);
        refWcssSum += Math.log(refWcss || 1);
      }

      const expectedLogWcss = refWcssSum / numReferences;
      const gap = expectedLogWcss - Math.log(wcss || 1);
      gaps.push(gap);
    }

    // Find optimal K using the elbow method on gaps
    // Look for the smallest k where gap(k) >= gap(k+1) - sd(k+1)
    let optimalK = 1;
    for (let k = 0; k < gaps.length - 1; k++) {
      // Simplified: find the largest gap or first significant drop
      if (k === 0 || gaps[k] >= gaps[k - 1]) {
        optimalK = k + 1;
      }
    }

    // Ensure we return a reasonable value (at least 2, at most maxK)
    return Math.max(2, Math.min(optimalK, maxK));
  };
  const clusterColors = [
    'rgba(255, 107, 107, 0.7)',   // Red
    'rgba(107, 194, 255, 0.7)',   // Blue
    'rgba(107, 255, 133, 0.7)',   // Green
    'rgba(255, 193, 7, 0.7)',     // Orange
    'rgba(206, 86, 255, 0.7)',    // Purple
    'rgba(255, 107, 193, 0.7)',   // Pink
    'rgba(107, 255, 255, 0.7)',   // Cyan
    'rgba(173, 107, 255, 0.7)',   // Indigo
    'rgba(255, 159, 64, 0.7)',    // Deep Orange
    'rgba(75, 192, 192, 0.7)',    // Teal
    'rgba(255, 99, 132, 0.7)',    // Light Red
    'rgba(54, 162, 235, 0.7)',    // Light Blue
    'rgba(201, 203, 207, 0.7)',   // Gray
    'rgba(255, 205, 86, 0.7)',    // Yellow
    'rgba(153, 102, 255, 0.7)',   // Light Purple
    'rgba(255, 159, 243, 0.7)',   // Light Pink
    'rgba(102, 255, 178, 0.7)',   // Light Green
    'rgba(255, 171, 87, 0.7)',    // Coral
    'rgba(87, 202, 142, 0.7)',    // Mint
    'rgba(220, 128, 255, 0.7)',   // Orchid
    'rgba(255, 178, 102, 0.7)',   // Peach
    'rgba(102, 221, 255, 0.7)',   // Sky Blue
    'rgba(178, 255, 102, 0.7)',   // Lime
    'rgba(255, 230, 109, 0.7)',   // Golden Yellow
    'rgba(180, 109, 255, 0.7)',   // Violet
    'rgba(255, 128, 171, 0.7)',   // Hot Pink
    'rgba(128, 255, 212, 0.7)',   // Aquamarine
    'rgba(255, 214, 165, 0.7)',   // Moccasin
    'rgba(165, 242, 255, 0.7)',   // Light Sky Blue
    'rgba(230, 255, 109, 0.7)',   // Yellow Green
    'rgba(240, 128, 255, 0.7)',   // Plum
    'rgba(255, 149, 128, 0.7)',   // Light Salmon
    'rgba(128, 224, 255, 0.7)',   // Light Blue
    'rgba(149, 255, 128, 0.7)',   // Light Green
    'rgba(255, 242, 128, 0.7)',   // Light Yellow
    'rgba(200, 128, 255, 0.7)',   // Light Violet
    'rgba(255, 180, 200, 0.7)',   // Light Rose
    'rgba(180, 255, 255, 0.7)',   // Light Cyan
    'rgba(255, 200, 124, 0.7)',   // Tan
    'rgba(150, 200, 255, 0.7)',   // Periwinkle
    'rgba(200, 255, 150, 0.7)',   // Light Lime
    'rgba(255, 255, 153, 0.7)',   // Pale Yellow
    'rgba(220, 150, 255, 0.7)',   // Light Magenta
    'rgba(255, 160, 180, 0.7)',   // Salmon Pink
    'rgba(160, 255, 220, 0.7)',   // Pale Cyan
    'rgba(255, 210, 140, 0.7)',   // Bisque
    'rgba(170, 220, 255, 0.7)',   // Powder Blue
    'rgba(220, 255, 170, 0.7)',   // Pale Green
    'rgba(255, 240, 140, 0.7)',   // Khaki
    'rgba(230, 170, 255, 0.7)',   // Lavender
    'rgba(255, 190, 210, 0.7)',   // Bubblegum
  ];

  const getColorForCluster = (clusterId: number) => {
    return clusterColors[clusterId % clusterColors.length];
  };

  // Register Chart.js plugins on component mount
  useEffect(() => {
    if (!pluginsRegistered) {
      try {
        ChartJS.register(ScatterController, LineController, LinearScale, CategoryScale, PointElement, LineElement, Tooltip, Legend, zoomPlugin);
        setPluginsRegistered(true);
      } catch (error) {
        console.error('Failed to register Chart.js plugins:', error);
      }
    }
  }, [pluginsRegistered]);

  // Handle keyboard shortcuts for undo/redo
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      if ((e.target as any).tagName === 'INPUT' || (e.target as any).tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl+Z for undo (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Ctrl+Y or Ctrl+Shift+Z for redo (or Cmd+Z with Shift on Mac)
      else if (((e.ctrlKey || e.metaKey) && e.key === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, embeddingPoints, clusterAssignments, chartData]);

  // Fetch subreddits on component mount
  useEffect(() => {
    fetchSubreddits();
  }, []);

  // Set selected subreddit when chart is loaded with subreddit parameter
  useEffect(() => {
    if (chartSubreddit && activeTab === 'chart') {
      setSelectedSubreddit(chartSubreddit);
    }
  }, [chartSubreddit, activeTab]);

  // Auto-trigger search when navigated to chart route with query param
  useEffect(() => {
    if (chartQuery && selectedSubreddit && activeTab === 'chart') {
      if (chartQueryType === 'semantic') {
        handleSemanticSearch();
      } else {
        handleExactSearch();
      }
    }
  }, [selectedSubreddit, activeTab]);

  const fetchSubreddits = async () => {
    setIsLoadingSubreddits(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/subreddits`);
      const data = await response.json();

      if (response.ok) {
        setSubreddits(data.subreddits || []);
        if (data.subreddits && data.subreddits.length > 0 && !selectedSubreddit) {
          setSelectedSubreddit(data.subreddits[0]);
        }
      } else {
        console.error('Error fetching subreddits:', data.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoadingSubreddits(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleExactSearch = async () => {
    if (!searchQuery.trim() || !selectedSubreddit) {
      return;
    }

    setIsSearching(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/search/exact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subreddit: selectedSubreddit,
          query: searchQuery,
        }),
      });

      const data = await response.json();

      if (response.ok && data.posts) {
        setSearchResults(data.posts);
        setDisplayedResultsCount(10);
        console.log(`Found ${data.posts.length} posts matching "${searchQuery}"`);
      } else {
        console.error('Search error:', data.error || 'Unknown error');
        setSearchResults([]);
        setHighlightedPostIds(new Set());
        setDisplayedResultsCount(10);
      }
    } catch (error) {
      console.error('Error performing exact search:', error);
      setSearchResults([]);
      setHighlightedPostIds(new Set());
    } finally {
      setIsSearching(false);
    }
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery.trim() || !selectedSubreddit) {
      return;
    }

    setIsSearching(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/search/semantic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subreddit: selectedSubreddit,
          query: searchQuery,
          metric: selectedMetric,
        }),
      });

      const data = await response.json();

      if (response.ok && data.posts) {
        setSearchResults(data.posts);
        setDisplayedResultsCount(10);
        // Store query position for chart display
        if (data.queryPosition) {
          setQueryPosition(data.queryPosition);
        }
        console.log(`Found ${data.posts.length} semantically similar posts`);
      } else {
        console.error('Search error:', data.error || 'Unknown error');
        setSearchResults([]);
        setHighlightedPostIds(new Set());
        setQueryPosition(null);
        setDisplayedResultsCount(10);
      }
    } catch (error) {
      console.error('Error performing semantic search:', error);
      setSearchResults([]);
      setHighlightedPostIds(new Set());
      setQueryPosition(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    if (searchType === 'exact') {
      handleExactSearch();
    } else {
      handleSemanticSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHighlightedPostIds(new Set());
    setQueryPosition(null);
    setDisplayedResultsCount(10);
  };

  const handleComputeApproximateLocation = async () => {
    if (!searchQuery.trim() || !selectedSubreddit || searchResults.length === 0) {
      return;
    }

    setIsSearching(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/search/approximate-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subreddit: selectedSubreddit,
          query: searchQuery,
          metric: selectedMetric,
        }),
      });

      const data = await response.json();

      if (response.ok && data.queryPosition) {
        setQueryPosition(data.queryPosition);
        console.log(`✓ Computed approximate location: [${data.queryPosition.x.toFixed(2)}, ${data.queryPosition.y.toFixed(2)}]`);
      } else {
        console.error('Approximation error:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error computing approximate location:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Get sorted search results
  const getSortedSearchResults = () => {
    // Results are already sorted by relevance from the backend
    // Return only the first displayedResultsCount items
    return searchResults.slice(0, displayedResultsCount);
  };

  const togglePostHighlight = (postId: string) => {
    setHighlightedPostIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  // Handle opening post modal from search results
  const handleSearchResultSelect = async (post: any) => {
    setSelectedPost(post);
    setShowPostModal(true);
    
    // Fetch full post details from backend
    setIsLoadingPostDetails(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/post-details/${post.post_id}`);
      const data = await response.json();
      
      if (response.ok && data.post) {
        setSelectedPost({
          ...post,
          ...data.post,
        });
      }
    } catch (error) {
      console.error('Error fetching post details:', error);
    } finally {
      setIsLoadingPostDetails(false);
    }
  };

  const fetchOverviewData = async (subreddit: string) => {
    setIsLoadingOverview(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/subreddit/${subreddit}/posts`);
      const data = await response.json();

      if (response.ok && data.posts) {
        const posts = data.posts;
        
        // Calculate date range
        const dates = posts
          .map((p: any) => new Date(p.created).getTime())
          .filter((d: number) => !isNaN(d));
        
        const minDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
        const maxDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

        // Check calibration status
        const calibratedPosts = posts.filter((p: any) => p.speech_type && p.speech_type.length > 0);
        const calibrationStatus = {
          total: posts.length,
          calibrated: calibratedPosts.length,
          isDone: calibratedPosts.length === posts.length && posts.length > 0,
        };

        // Group posts by date for the line chart
        const postsGroupedByDate: Record<string, number> = {};
        posts.forEach((post: any) => {
          if (post.created) {
            const date = new Date(post.created);
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            postsGroupedByDate[dateStr] = (postsGroupedByDate[dateStr] || 0) + 1;
          }
        });

        // Sort dates and create chart data
        const sortedDates = Object.keys(postsGroupedByDate).sort();
        // Exclude first and last dates
        const chartDates = sortedDates.slice(1, -1);
        const chartDataPoints = chartDates.map(dateStr => ({
          x: new Date(dateStr).getTime(),
          y: postsGroupedByDate[dateStr],
          dateStr: dateStr,
        }));

        setOverviewData({
          totalPosts: posts.length,
          minDate,
          maxDate,
          calibrationStatus,
        });

        setPostsOverTimeData({
          labels: chartDates,
          datasets: [
            {
              label: 'Posts per Day',
              data: chartDataPoints,
              borderColor: '#FF3B3B',
              backgroundColor: 'rgba(255, 59, 59, 0.1)',
              tension: 0.4,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: '#FF3B3B',
              pointBorderColor: '#FF3B3B',
              pointHoverRadius: 6,
            },
          ],
        });

        // Entity Trend over Time
        const entityDateCounts: Record<string, Record<string, number>> = {};
        const entityTotals: Record<string, number> = {};
        posts.forEach((post: any) => {
          if (!post.entities || !post.created) return;
          const dateStr = new Date(post.created).toISOString().slice(0, 10);
          (post.entities as string[]).forEach((entity: string) => {
            if (!entityDateCounts[entity]) entityDateCounts[entity] = {};
            entityDateCounts[entity][dateStr] = (entityDateCounts[entity][dateStr] || 0) + 1;
            entityTotals[entity] = (entityTotals[entity] || 0) + 1;
          });
        });

        const topEntities = Object.entries(entityTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name]) => name);

        const trendColors = [
          '#FF6B6B', '#6BC2FF', '#6BFF85', '#FFC107',
          '#CE56FF', '#FF6BC1', '#6BFFFF', '#AD6BFF',
        ];

        if (topEntities.length > 0 && chartDates.length > 0) {
          setEntityTrendData({
            labels: chartDates,
            datasets: topEntities.map((entity, idx) => ({
              label: entity,
              data: chartDates.map(dateStr => ({
                x: new Date(dateStr).getTime(),
                y: entityDateCounts[entity]?.[dateStr] || 0,
                dateStr,
              })),
              borderColor: trendColors[idx % trendColors.length],
              backgroundColor: 'transparent',
              tension: 0.4,
              fill: false,
              pointRadius: 2,
              pointHoverRadius: 5,
              borderWidth: 2,
            })),
          });
        } else {
          setEntityTrendData(null);
        }

        // Top entities leaderboard (top 20)
        const rankedEntities = Object.entries(entityTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([name, count]) => ({ name, count }));
        setTopEntitiesData(rankedEntities);

        // Top platforms leaderboard
        const platformCounts: Record<string, number> = {};
        posts.forEach((post: any) => {
          if (!post.links || !Array.isArray(post.links)) return;
          post.links.forEach((link: any) => {
            const platform = (typeof link === 'string' ? link : link?.platform) || 'Unknown';
            platformCounts[platform] = (platformCounts[platform] || 0) + 1;
          });
        });
        const rankedPlatforms = Object.entries(platformCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([platform, count]) => ({ platform, count }));
        setTopPlatformsData(rankedPlatforms);

        // Entity co-occurrence pairs
        const pairCounts: Record<string, number> = {};
        posts.forEach((post: any) => {
          if (!post.entities || !Array.isArray(post.entities)) return;
          const unique = [...new Set(post.entities as string[])];
          for (let i = 0; i < unique.length; i++) {
            for (let j = i + 1; j < unique.length; j++) {
              const key = [unique[i], unique[j]].sort().join('|||');
              pairCounts[key] = (pairCounts[key] || 0) + 1;
            }
          }
        });
        const rankedPairs = Object.entries(pairCounts)
          .filter(([, count]) => count >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([key, count]) => {
            const [a, b] = key.split('|||');
            return { a, b, count };
          });
        setEntityCooccurrenceData(rankedPairs);
      } else {
        console.error('Error fetching overview data:', data.error);
        setOverviewData(null);
      }
    } catch (error) {
      console.error('Error:', error);
      setOverviewData(null);
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const fetchOverviewEmbeddings = async (subreddit: string) => {
    setIsLoadingOverviewEmbeddings(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const url = new URL(`${apiUrl}/api/embeddings/${subreddit}/ai`);
      url.searchParams.append('includeMetadata', 'true');
      
      const response = await fetch(url.toString());
      const data = await response.json();

      if (response.ok && data.points && data.points.length > 0) {
        // Prepare scatter plot data
        const chartConfig = {
          labels: data.points.map((p: any) => p.post_id),
          datasets: [
            {
              label: 'AI Embeddings',
              data: data.points.map((p: any) => ({
                x: p.x,
                y: p.y,
                title: p.title,
                author: p.author,
                comments: p.comments,
                ups: p.ups,
                created: p.created,
                post_id: p.post_id,
              })),
              backgroundColor: 'rgba(156, 39, 176, 0.6)',
              borderColor: 'transparent',
              borderWidth: 0,
              pointRadius: 5,
              pointHoverRadius: 8,
            },
          ],
        };

        setOverviewEmbeddingPoints(data.points);
        setOverviewEmbeddingData(chartConfig);
        // Compute timeline bounds
        const timestamps = data.points
          .map((p: any) => p.created ? new Date(p.created).getTime() : null)
          .filter((t: number | null): t is number => t !== null);
        if (timestamps.length > 1) {
          const uniqueDates = Array.from(new Set(
            timestamps.map((t: number) => new Date(t).toISOString().slice(0, 10))
          )).sort() as string[];
          setOverviewTimelineBounds({ min: Math.min(...timestamps), max: Math.max(...timestamps), dates: uniqueDates });
        }
        setOverviewTimelinePos(50);
        setOverviewTimelineEnabled(false);
        console.log(`✓ Loaded ${data.points.length} embedding points for overview in r/${subreddit}`);
      } else {
        console.warn(`No embedding data found for overview in r/${subreddit}`);
        setOverviewEmbeddingData(null);
      }
    } catch (error) {
      console.error('Failed to fetch overview embedding data:', error);
      setOverviewEmbeddingData(null);
    } finally {
      setIsLoadingOverviewEmbeddings(false);
    }
  };

  const fetchOverview3DEmbeddings = async (subreddit: string) => {
    setIsLoading3D(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/embeddings3d/${encodeURIComponent(subreddit)}`);
      const data = await response.json();
      if (response.ok && data.points && data.points.length > 0) {
        setOverview3DPoints(data.points);
      } else {
        setOverview3DPoints([]);
      }
    } catch (error) {
      console.error('Failed to fetch 3D embedding data:', error);
      setOverview3DPoints([]);
    } finally {
      setIsLoading3D(false);
    }
  };

  const fetchEmbeddingData = async (subreddit: string, metric: string) => {
    setIsLoadingChart(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const url = new URL(`${apiUrl}/api/embeddings/${subreddit}/${metric}`);
      
      // Always include metadata for groups display
      url.searchParams.append('includeMetadata', 'true');
      
      const response = await fetch(url.toString());
      const data = await response.json();

      if (response.ok && data.points && data.points.length > 0) {
        // Store embedding points for clustering
        setEmbeddingPoints(data.points);
        setClusterAssignments({});
        setNormalizedColorValues([]);

        // Get base color
        const baseMetricColor: Record<string, string> = {
          ai: 'rgba(156, 39, 176, 0.6)',
          pain: 'rgba(255, 184, 77, 0.6)',
          advice: 'rgba(102, 187, 106, 0.6)',
          narrative: 'rgba(66, 165, 245, 0.6)',
        };
        const backgroundColor = baseMetricColor[metric] || 'rgba(100, 100, 100, 0.6)';

        // Create scatter plot data
        const chartConfig = {
          labels: data.points.map((p: any) => p.post_id),
          datasets: [
            {
              label: `${metric.charAt(0).toUpperCase() + metric.slice(1)} Embeddings`,
              data: data.points.map((p: any) => ({
                x: p.x,
                y: p.y,
                title: p.title,
                author: p.author,
                detail: p.detail,
                comments: p.comments,
                ups: p.ups,
                upvote_ratio: p.upvote_ratio || 0,
                created: p.created,
                speech_type: p.speech_type || [],
                post_id: p.post_id,
              })),
              backgroundColor: backgroundColor,
              borderColor: 'transparent',
              borderWidth: 0,
              pointRadius: 5,
              pointHoverRadius: 8,
            },
          ],
        };

        setChartData(chartConfig);
        setChartDataUnfiltered(chartConfig);
        console.log(`✓ Loaded ${data.points.length} embedding points for ${metric} in r/${subreddit}`);
      } else {
        console.warn(`No embedding data found for ${metric} in r/${subreddit}`);
        setChartData(null);
      }
    } catch (error) {
      console.error('Failed to fetch embedding data:', error);
      setChartData(null);
    } finally {
      setIsLoadingChart(false);
    }
  };

  // Fetch embeddings when subreddit, metric, or color metric changes
  useEffect(() => {
    // Reset cluster UI state when switching metrics/subreddits
    setHiddenClusters(new Set());
    setFocusedCluster(null);
    setHighlightedClusters(new Set());
    setHighlightTag(new Set());
    setClusterNames({});
    setManualClusterNames({});
    setEditingCluster(null);
    setTimelineEnabled(false);
    setTimelinePos(50);
    setTimelineBounds(null);
    
    if (selectedSubreddit && activeTab === 'chart' && pluginsRegistered) {
      fetchEmbeddingData(selectedSubreddit, selectedMetric);
    }
  }, [selectedSubreddit, selectedMetric, activeTab, pluginsRegistered]);

  // Fetch overview data when subreddit or tab changes
  useEffect(() => {
    if (selectedSubreddit && activeTab === 'overview') {
      fetchOverviewData(selectedSubreddit);
      fetchOverviewEmbeddings(selectedSubreddit);
      fetchOverview3DEmbeddings(selectedSubreddit);
    }
  }, [selectedSubreddit, activeTab]);

  // Recompute color intensity values locally when color metric changes (no refetch)
  useEffect(() => {
    if (embeddingPoints.length === 0) return;
    let colorValues: number[] = [];
    if (selectedColorMetric === 'comments') {
      colorValues = embeddingPoints.map((p: any) => p.comments || 0);
    } else if (selectedColorMetric === 'ups') {
      colorValues = embeddingPoints.map((p: any) => p.ups || 0);
    } else if (selectedColorMetric === 'date') {
      colorValues = embeddingPoints.map((p: any) => p.created ? new Date(p.created).getTime() : 0);
    } else if (selectedColorMetric === 'upvote_ratio') {
      // Lower ratio = darker, so invert: use (1 - ratio) so low ratio maps to high normalized value
      colorValues = embeddingPoints.map((p: any) => p.upvote_ratio != null ? 1 - p.upvote_ratio : 0.5);
    }
    setNormalizedColorValues(colorValues.length > 0 ? normalizeValues(colorValues) : []);
  }, [selectedColorMetric, embeddingPoints]);

  // Compute timeline bounds when embedding points load
  useEffect(() => {
    if (embeddingPoints.length === 0) return;
    const timestamps = embeddingPoints
      .map((p: any) => p.created ? new Date(p.created).getTime() : null)
      .filter((t): t is number => t !== null);
    if (timestamps.length === 0) return;
    // Collect unique dates (YYYY-MM-DD) sorted ascending
    const uniqueDates = Array.from(new Set(
      timestamps.map(t => new Date(t).toISOString().slice(0, 10))
    )).sort();
    setTimelineBounds({ min: Math.min(...timestamps), max: Math.max(...timestamps), dates: uniqueDates });
    setTimelinePos(50);
  }, [embeddingPoints]);

  // Update URL when subreddit changes in chart tab
  useEffect(() => {
    if (activeTab === 'chart' && selectedSubreddit) {
      router.push(`/insight/chart?subreddit=${selectedSubreddit}`);
    }
  }, [selectedSubreddit, activeTab, router]);

  // Update chart visualization when clustering changes (without refetching data)
  useEffect(() => {
    if (chartData && Object.keys(clusterAssignments).length > 0) {
      // Update dataset colors based on cluster assignments
      const updatedData = {
        ...chartData,
        datasets: [
          {
            ...chartData.datasets[0],
            backgroundColor: (context: any) => {
              const dataIndex = context.dataIndex;
              const postId = embeddingPoints[dataIndex].post_id;
              const clusterId = clusterAssignments[postId];
              const baseColor = clusterId !== undefined ? getColorForCluster(clusterId) : 'rgba(128, 128, 128, 0.5)';
              if (selectedColorMetric !== 'none' && normalizedColorValues[dataIndex] !== undefined) {
                return getColorForIntensity(normalizedColorValues[dataIndex], baseColor);
              }
              return baseColor;
            },
          },
        ],
      };
      setChartData(updatedData);
      setChartDataUnfiltered(updatedData);
    }
  }, [clusterAssignments]);

  // Filter chart data based on hidden/focused clusters
  useEffect(() => {
    if (chartDataUnfiltered && embeddingPoints.length > 0) {
      const filteredPoints = embeddingPoints.filter((point) => {
        const clusterId = clusterAssignments[point.post_id];
        const clusterKey = clusterId !== undefined ? `cluster_${clusterId}` : 'unassigned';

        // If focused cluster is set, only show that cluster
        if (focusedCluster) {
          return focusedCluster === clusterKey;
        }

        // Otherwise, show all clusters except hidden ones
        return !hiddenClusters.has(clusterKey);
      });

      const filteredChartData = {
        ...chartDataUnfiltered,
        labels: filteredPoints.map(() => ''),
        datasets: [
          {
            ...chartDataUnfiltered.datasets[0],
            data: filteredPoints.map((p) => ({
              x: p.x,
              y: p.y,
              title: p.title,
              author: p.author,
              detail: p.detail,
              comments: p.comments,
              ups: p.ups,
              post_id: p.post_id,
            })),
            backgroundColor: (context: any) => {
              const point = filteredPoints[context.dataIndex];
              const origIdx = embeddingPoints.findIndex(p => p.post_id === point.post_id);
              const clusterId = clusterAssignments[point.post_id];
              const clusterKey = clusterId !== undefined ? `cluster_${clusterId}` : 'unassigned';
              const hasTag = highlightTag.size === 0 || (point.speech_type && point.speech_type.some((t: string) => highlightTag.has(t)));

              // Timeline dimming — highlight only posts from the selected day
              if (timelineEnabled && timelineBounds) {
                const dateIdx = Math.round((timelinePos / 100) * (timelineBounds.dates.length - 1));
                const activeDate = timelineBounds.dates[dateIdx];
                const postDate = point.created ? new Date(point.created).toISOString().slice(0, 10) : null;
                if (postDate !== activeDate) {
                  return 'rgba(80, 80, 80, 0.08)';
                }
              }

              if (highlightTag.size > 0 && !hasTag) {
                return 'rgba(80, 80, 80, 0.12)';
              }

              if (highlightedClusters.size > 0 && !highlightedClusters.has(clusterKey)) {
                return 'rgba(80, 80, 80, 0.2)';
              }

              const baseColor = clusterId !== undefined ? getColorForCluster(clusterId) : 'rgba(128, 128, 128, 0.5)';
              if (selectedColorMetric !== 'none' && origIdx !== -1 && normalizedColorValues[origIdx] !== undefined) {
                return getColorForIntensity(normalizedColorValues[origIdx], baseColor);
              }
              return baseColor;
            },
            pointRadius: (selectedColorMetric === 'comments' || selectedColorMetric === 'ups')
              ? (context: any) => {
                  const point = filteredPoints[context.dataIndex];
                  const origIdx = embeddingPoints.findIndex(p => p.post_id === point.post_id);
                  return origIdx !== -1 && normalizedColorValues[origIdx] !== undefined
                    ? 4 + normalizedColorValues[origIdx] * 6
                    : 5;
                }
              : 5,
          },
        ],
      };

      setChartData(filteredChartData);
    }
  }, [hiddenClusters, focusedCluster, chartDataUnfiltered, highlightedClusters, clusterAssignments, embeddingPoints, highlightTag, normalizedColorValues, selectedColorMetric, timelineEnabled, timelinePos, timelineBounds]);

  // Update chart when highlighted posts change (search results)
  useEffect(() => {
    if (!chartDataUnfiltered) {
      return;
    }

    // Get the base dataset (first dataset, which contains all points)
    const baseDataset = chartDataUnfiltered.datasets[0];
    if (!baseDataset || !baseDataset.data) {
      return;
    }

    // Filter out any existing "Search Results" and "Query" datasets
    const baseDatasets = chartDataUnfiltered.datasets.filter(
      (ds: any) => ds.label !== 'Search Results' && ds.label !== 'Query'
    );

    // If no highlighted posts and no query position, just use the base datasets
    if (highlightedPostIds.size === 0 && !queryPosition) {
      setChartData({
        ...chartDataUnfiltered,
        datasets: baseDatasets,
      });
      return;
    }

    // Create datasets array to accumulate datasets
    const datasets = [...baseDatasets];

    // Create a new dataset for highlighted posts with distinctive styling
    if (highlightedPostIds.size > 0) {
      const highlightedData = baseDataset.data.filter((point: any) => 
        highlightedPostIds.has(point.post_id)
      );

      if (highlightedData.length > 0) {
        const highlightedDataset = {
          label: 'Search Results',
          data: highlightedData,
          backgroundColor: 'rgba(255, 184, 77, 0.8)', // Yellow/gold
          borderColor: 'rgba(255, 255, 0, 0.9)', // Bright yellow border
          borderWidth: 2.5,
          pointRadius: 7,
          pointHoverRadius: 10,
        };
        datasets.push(highlightedDataset);
      }
    }

    // Add query point as a dataset if query position exists
    if (queryPosition) {
      const queryDataset = {
        label: 'Query',
        data: [{
          x: queryPosition.x,
          y: queryPosition.y,
          title: 'Search Query',
        }],
        backgroundColor: 'rgba(100, 200, 255, 0.9)', // Cyan
        borderColor: 'rgba(100, 200, 255, 1)',
        borderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 11,
        pointStyle: () => {
          // Create a cross/plus shape for query point
          const canvas = document.createElement('canvas');
          const size = 16;
          canvas.width = size;
          canvas.height = size;
          const ctxCanvas = canvas.getContext('2d');
          if (ctxCanvas) {
            ctxCanvas.strokeStyle = 'rgba(100, 200, 255, 1)';
            ctxCanvas.lineWidth = 3;
            ctxCanvas.beginPath();
            // Horizontal line
            ctxCanvas.moveTo(0, size / 2);
            ctxCanvas.lineTo(size, size / 2);
            ctxCanvas.stroke();
            // Vertical line
            ctxCanvas.beginPath();
            ctxCanvas.moveTo(size / 2, 0);
            ctxCanvas.lineTo(size / 2, size);
            ctxCanvas.stroke();
          }
          return canvas;
        },
      };
      datasets.push(queryDataset);
    }

    const updatedChartData = {
      ...chartDataUnfiltered,
      datasets,
    };
    setChartData(updatedChartData);
  }, [highlightedPostIds, chartDataUnfiltered, queryPosition]);

  // Update highlighted posts when displayed results count changes
  useEffect(() => {
    if (searchResults.length === 0) {
      return;
    }
    
    // Highlight only the currently displayed results
    const displayedResults = searchResults.slice(0, displayedResultsCount);
    const postIds = new Set(displayedResults.map((post: any) => post.post_id));
    setHighlightedPostIds(postIds);
  }, [searchResults, displayedResultsCount]);

  // Handle K-means clustering
  const handleCluster = () => {
    if (embeddingPoints.length === 0) {
      alert('No embedding data available. Please select a metric first.');
      return;
    }

    setIsClusteringLoading(true);
    try {
      const assignments = kmeansCluster(embeddingPoints, numClusters);
      setClusterAssignments(assignments);
      console.log(`✓ Clustered ${embeddingPoints.length} posts into ${numClusters} clusters`);
    } catch (error) {
      console.error('Clustering error:', error);
      alert('Failed to perform clustering');
    } finally {
      setIsClusteringLoading(false);
    }
  };

  // Auto-detect optimal K using Gap Statistic
  const handleAutoDetectK = () => {
    if (embeddingPoints.length === 0) {
      alert('No embedding data available. Please select a metric first.');
      return;
    }

    setIsDetectingK(true);
    try {
      // Run in a setTimeout to avoid blocking the UI
      setTimeout(() => {
        const optimalK = gapStatisticOptimalK(embeddingPoints, Math.min(15, Math.ceil(Math.sqrt(embeddingPoints.length))));
        setDetectedK(optimalK);
        setNumClusters(optimalK);
        console.log(`✓ Auto-detected optimal K: ${optimalK}`);
      }, 100);
    } catch (error) {
      console.error('Auto-detection error:', error);
      alert('Failed to auto-detect optimal K');
    } finally {
      setTimeout(() => setIsDetectingK(false), 200);
    }
  };

  // Handle group selection
  const handleGroupSelect = (groupName: string) => {
    setSelectedGroup(groupName);
    setShowGroupModal(true);
  };

  // Handle post selection from chart
  const handlePostSelect = async (postIndex: number) => {
    if (postIndex < 0 || postIndex >= embeddingPoints.length) return;
    
    const post = embeddingPoints[postIndex];
    setSelectedPost(post);
    setShowPostModal(true);
    
    // Fetch full post details from backend
    setIsLoadingPostDetails(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/post-details/${post.post_id}`);
      const data = await response.json();
      
      if (response.ok && data.post) {
        setSelectedPost({
          ...post,
          ...data.post,
        });
      }
    } catch (error) {
      console.error('Error fetching post details:', error);
    } finally {
      setIsLoadingPostDetails(false);
    }
  };

  const handleRemovePoint = (pointIndex: number) => {
    if (pointIndex < 0 || pointIndex >= embeddingPoints.length) return;

    // Save current state to undo stack
    setUndoStack(prev => [...prev, {
      embeddingPoints,
      clusterAssignments,
      chartData,
    }]);
    // Clear redo stack when performing a new action
    setRedoStack([]);

    const pointToRemove = embeddingPoints[pointIndex];
    
    // Remove from embedding points
    const updatedPoints = embeddingPoints.filter((_, idx) => idx !== pointIndex);
    setEmbeddingPoints(updatedPoints);

    // Update cluster assignments by removing the deleted point
    const updatedAssignments = { ...clusterAssignments };
    delete updatedAssignments[pointToRemove.post_id];
    setClusterAssignments(updatedAssignments);

    // Update chart data
    if (chartData && chartData.datasets[0]) {
      const updatedDatasets = chartData.datasets.map((dataset: any) => ({
        ...dataset,
        data: dataset.data.filter((_: any, idx: number) => idx !== pointIndex),
      }));

      setChartData({
        ...chartData,
        datasets: updatedDatasets,
      });

      setChartDataUnfiltered({
        ...chartDataUnfiltered,
        datasets: updatedDatasets,
      });
    }

    // Close context menu and selected post modal if it was the removed point
    setContextMenu(null);
    setContextMenuPoint(null);
    if (selectedPost?.post_id === pointToRemove.post_id) {
      setShowPostModal(false);
      setSelectedPost(null);
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    
    // Save current state to redo stack
    setRedoStack(prev => [...prev, {
      embeddingPoints,
      clusterAssignments,
      chartData,
    }]);

    // Restore previous state
    setEmbeddingPoints(previousState.embeddingPoints);
    setClusterAssignments(previousState.clusterAssignments);
    setChartData(previousState.chartData);
    setChartDataUnfiltered(previousState.chartData);

    // Remove from undo stack
    setUndoStack(prev => prev.slice(0, -1));

    // Close any open modals
    setContextMenu(null);
    setContextMenuPoint(null);
    setShowPostModal(false);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];

    // Save current state to undo stack
    setUndoStack(prev => [...prev, {
      embeddingPoints,
      clusterAssignments,
      chartData,
    }]);

    // Restore next state
    setEmbeddingPoints(nextState.embeddingPoints);
    setClusterAssignments(nextState.clusterAssignments);
    setChartData(nextState.chartData);
    setChartDataUnfiltered(nextState.chartData);

    // Remove from redo stack
    setRedoStack(prev => prev.slice(0, -1));

    // Close any open modals
    setContextMenu(null);
    setContextMenuPoint(null);
    setShowPostModal(false);
  };

  const handleRemoveGroup = (groupId: string) => {
    // Get all points in this group
    const groupedPosts = getGroupedPosts();
    const postsToRemove = groupedPosts[groupId] || [];
    
    if (postsToRemove.length === 0) return;

    // Save current state to undo stack
    setUndoStack(prev => [...prev, {
      embeddingPoints,
      clusterAssignments,
      chartData,
    }]);
    // Clear redo stack when performing a new action
    setRedoStack([]);

    // Get indices of points to remove (need to iterate in reverse to avoid index shifting)
    const indicesToRemove = new Set<number>();
    postsToRemove.forEach((post) => {
      const index = embeddingPoints.findIndex(p => p.post_id === post.post_id);
      if (index !== -1) {
        indicesToRemove.add(index);
      }
    });

    // Remove points in reverse order to maintain correct indices
    const sortedIndices = Array.from(indicesToRemove).sort((a, b) => b - a);
    let updatedPoints = [...embeddingPoints];
    sortedIndices.forEach(index => {
      updatedPoints.splice(index, 1);
    });
    setEmbeddingPoints(updatedPoints);

    // Update cluster assignments by removing all posts from this group
    const updatedAssignments = { ...clusterAssignments };
    postsToRemove.forEach(post => {
      delete updatedAssignments[post.post_id];
    });
    setClusterAssignments(updatedAssignments);

    // Update chart data
    if (chartData && chartData.datasets[0]) {
      const updatedDatasets = chartData.datasets.map((dataset: any) => ({
        ...dataset,
        data: dataset.data.filter((_: any, idx: number) => !indicesToRemove.has(idx)),
      }));

      setChartData({
        ...chartData,
        datasets: updatedDatasets,
      });

      setChartDataUnfiltered({
        ...chartDataUnfiltered,
        datasets: updatedDatasets,
      });
    }

    // Close the group modal
    setShowGroupModal(false);
    setSelectedGroup(null);

    console.log(`✓ Removed group "${groupId}" with ${postsToRemove.length} points`);
  };

  const handleKeepOnlySearchResults = () => {
    // Get only the currently displayed results (not all results)
    const displayedResults = getSortedSearchResults();
    if (displayedResults.length === 0) return;

    // Save current state to undo stack
    setUndoStack(prev => [...prev, {
      embeddingPoints,
      clusterAssignments,
      chartData,
    }]);
    // Clear redo stack when performing a new action
    setRedoStack([]);

    // Get the post IDs of displayed search results only
    const displayedResultIds = new Set(displayedResults.map(post => post.post_id));

    // Keep only points that are in displayed search results
    const updatedPoints = embeddingPoints.filter(point => displayedResultIds.has(point.post_id));

    // Get indices of points to remove
    const indicesToRemove = new Set<number>();
    embeddingPoints.forEach((point, idx) => {
      if (!displayedResultIds.has(point.post_id)) {
        indicesToRemove.add(idx);
      }
    });

    setEmbeddingPoints(updatedPoints);

    // Update cluster assignments to only keep displayed search result points
    const updatedAssignments: Record<string, number> = {};
    updatedPoints.forEach(point => {
      if (clusterAssignments[point.post_id] !== undefined) {
        updatedAssignments[point.post_id] = clusterAssignments[point.post_id];
      }
    });
    setClusterAssignments(updatedAssignments);

    // Update chart data
    if (chartData && chartData.datasets[0]) {
      const updatedDatasets = chartData.datasets.map((dataset: any) => ({
        ...dataset,
        data: dataset.data.filter((_: any, idx: number) => !indicesToRemove.has(idx)),
      }));

      setChartData({
        ...chartData,
        datasets: updatedDatasets,
      });

      setChartDataUnfiltered({
        ...chartDataUnfiltered,
        datasets: updatedDatasets,
      });
    }

    console.log(`✓ Kept only displayed results: ${updatedPoints.length} points remain (${embeddingPoints.length - updatedPoints.length} removed)`);
  };

  // Get grouped posts by cluster
  const getGroupedPosts = () => {
    const grouped: Record<string, any[]> = {
      unassigned: [],
    };

    embeddingPoints.forEach((point) => {
      const clusterId = clusterAssignments[point.post_id];
      if (clusterId !== undefined) {
        const key = `cluster_${clusterId}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(point);
      } else {
        grouped.unassigned.push(point);
      }
    });

    return grouped;
  };

  const getSortedGroupEntries = () => {
    const grouped = getGroupedPosts();
    const entries = Object.entries(grouped);

    return entries.sort(([_, postsA], [__, postsB]) => {
      if (groupSortBy === 'posts') {
        return postsB.length - postsA.length;
      } else if (groupSortBy === 'comments') {
        const commentsA = postsA.reduce((sum, p) => sum + (p.comments || 0), 0);
        const commentsB = postsB.reduce((sum, p) => sum + (p.comments || 0), 0);
        return commentsB - commentsA;
      } else if (groupSortBy === 'ups') {
        const upsA = postsA.reduce((sum, p) => sum + (p.ups || 0), 0);
        const upsB = postsB.reduce((sum, p) => sum + (p.ups || 0), 0);
        return upsB - upsA;
      }
      return 0;
    });
  };

  const generateClusterNames = async () => {
    setIsNamingClusters(true);
    try {
      const grouped = getGroupedPosts();
      const clusterData: Record<string, any> = {};

      // Prepare cluster data for naming and overview generation
      Object.entries(grouped).forEach(([groupName, posts]) => {
        if (groupName !== 'unassigned') {
          clusterData[groupName] = {
            posts: posts.map(p => ({
              title: p.title,
              content: p.content,
              upvotes: p.ups,
              comments: p.comments,
            })),
            postCount: posts.length,
          };
        }
      });

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/api/name-clusters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusters: clusterData }),
      });

      if (response.ok) {
        const data = await response.json();
        setClusterNames(data.names || {});
        setGroupOverviews(data.overviews || {});
        console.log('✓ Generated cluster names and overviews in a single request');
      }
    } catch (error) {
      console.error('Error generating cluster names and overviews:', error);
    } finally {
      setIsNamingClusters(false);
    }
  };


  // Chart options
  const chartOptions: ChartOptions<'scatter'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: true, // Only interact with points directly
      mode: 'nearest',
    },
    onClick: (event: any) => {
      // Chart.js provides active elements when intersect: true
      if (!event.native) return;
      
      const canvas = event.chart.canvas;
      const rect = canvas.getBoundingClientRect();
      const clickX = event.native.clientX - rect.left;
      const clickY = event.native.clientY - rect.top;
      
      // Find the closest point to the click position (in pixels)
      let closestIndex = -1;
      let closestPixelDistance = Infinity;
      const pixelThreshold = 15; // 15 pixels = approximately a data point's click radius
      
      if (chartData?.datasets[0]?.data) {
        const xScale = event.chart.scales.x;
        const yScale = event.chart.scales.y;
        
        chartData.datasets[0].data.forEach((point: any, index: number) => {
          // Convert data coordinates to pixel coordinates
          const pixelX = xScale.getPixelForValue(point.x);
          const pixelY = yScale.getPixelForValue(point.y);
          
          const distance = Math.sqrt(Math.pow(pixelX - clickX, 2) + Math.pow(pixelY - clickY, 2));
          if (distance < closestPixelDistance) {
            closestPixelDistance = distance;
            closestIndex = index;
          }
        });
      }
      
      // Only process if clicked very close to a point
      if (closestPixelDistance < pixelThreshold && closestIndex >= 0 && closestIndex < embeddingPoints.length) {
        if (event.native.button === 0) { // Left click
          handlePostSelect(closestIndex);
        } else if (event.native.button === 2) { // Right click
          event.native.preventDefault();
          const point = embeddingPoints[closestIndex];
          setContextMenuPoint({ ...point, index: closestIndex });
          setContextMenu({ x: event.native.clientX, y: event.native.clientY });
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: '#A1A1AA',
          font: {
            size: 12,
          },
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: '#18181F',
        titleColor: '#E6E6EB',
        bodyColor: '#A1A1AA',
        borderColor: '#2A2A33',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 13, weight: 'bold' as const },
        bodyFont: { size: 12 },
        displayColors: false,
        callbacks: {
          title: (context: any) => {
            if (context.length > 0) {
              const point = context[0].raw;
              return point.title || 'Post';
            }
            return '';
          },
          label: (context: any) => {
            const point = context.raw;
            return [
              `X: ${point.x?.toFixed(2) || 'N/A'}`,
              `Y: ${point.y?.toFixed(2) || 'N/A'}`,
              ...(point.author ? [`Author: ${point.author}`] : []),
              ...(point.detail ? [`Detail: ${point.detail}`] : []),
              ...(selectedColorMetric === 'comments' && point.comments !== undefined ? [`Comments: ${point.comments}`] : []),
              ...(selectedColorMetric === 'ups' && point.ups !== undefined ? [`Upvotes: ${point.ups}`] : []),
              ...(selectedColorMetric === 'date' && point.created ? [`Date: ${new Date(point.created).toLocaleDateString()}`] : []),
              ...(selectedColorMetric === 'upvote_ratio' && point.upvote_ratio !== undefined ? [`Upvote Ratio: ${(point.upvote_ratio * 100).toFixed(0)}%`] : []),
            ];
          },
        },
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'xy',
        },
        pan: {
          enabled: true,
          mode: 'xy',
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        position: 'bottom',
        grid: {
          color: '#2A2A33',
        },
        ticks: {
          color: '#A1A1AA',
          font: {
            size: 12,
          },
        },
      },
      y: {
        grid: {
          color: '#2A2A33',
        },
        ticks: {
          color: '#A1A1AA',
          font: {
            size: 12,
          },
        },
      },
    },
  };

  return (
    <main className="h-[calc(100vh-3rem)] bg-[#0B0B0F] flex relative">
      {/* Mobile sidebar toggle (inside header bar) */}
      <button
        onClick={() => setSidebarOpen(o => !o)}
        className="lg:hidden fixed top-0 left-0 z-[60] h-12 w-12 flex items-center justify-center text-[#A1A1AA] hover:text-[#E6E6EB] transition-colors"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar backdrop (mobile) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 top-12 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static top-12 lg:top-0 z-40 w-80 h-[calc(100vh-3rem)] border-r border-[#2A2A33] bg-[#0B0B0F] overflow-y-auto flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Header */}
        <div className="sticky top-0 bg-[#0B0B0F] border-b border-[#2A2A33] p-5 z-10">
          <Link href="/" className="inline-flex items-center gap-2 text-[#A1A1AA] hover:text-[#E6E6EB] transition-colors group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back</span>
          </Link>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* Tabs */}
            <div className="flex gap-2 bg-[#18181F] border border-[#2A2A33] rounded-[10px] p-1.5">
              <button
                onClick={() => router.push('/insight')}
                className={`flex-1 px-3 py-2.5 rounded-[8px] text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'overview'
                    ? 'bg-[#FF3B3B] text-white shadow-lg shadow-[#FF3B3B]/20'
                    : 'text-[#A1A1AA] hover:text-[#E6E6EB] hover:bg-[#2A2A33]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => router.push('/insight/chart')}
                className={`flex-1 px-3 py-2.5 rounded-[8px] text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'chart'
                    ? 'bg-[#FF3B3B] text-white shadow-lg shadow-[#FF3B3B]/20'
                    : 'text-[#A1A1AA] hover:text-[#E6E6EB] hover:bg-[#2A2A33]'
                }`}
              >
                Chart
              </button>
            </div>

            {/* Subreddits Section for Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-3 border border-[#2A2A33] rounded-[8px] overflow-hidden">
                <button
                  onClick={() => toggleSection('subreddits')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#18181F] hover:bg-[#1E1E28] transition-colors"
                >
                  <h3 className="text-[13px] font-bold text-[#E6E6EB] uppercase tracking-wide">
                    Subreddits
                  </h3>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A1A1AA] transition-transform duration-200 ${
                      expandedSections.subreddits ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.subreddits && (
                  <div className="px-3 pb-3 max-h-96 overflow-y-auto">
                    {isLoadingSubreddits ? (
                      <div className="text-center text-[#A1A1AA] text-sm py-4">Loading...</div>
                    ) : subreddits.length > 0 ? (
                      <div className="space-y-2">
                        {subreddits.map((subreddit) => (
                          <button
                            key={subreddit}
                            onClick={() => { setSelectedSubreddit(subreddit); setSidebarOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-[8px] text-sm transition-all ${
                              selectedSubreddit === subreddit
                                ? 'bg-[#FF3B3B] text-white shadow-lg shadow-[#FF3B3B]/20'
                                : 'bg-[#0B0B0F] border border-[#2A2A33] text-[#A1A1AA] hover:text-[#E6E6EB] hover:border-[#FF3B3B]/20'
                            }`}
                          >
                            r/{subreddit}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-[#A1A1AA] text-sm py-4">
                        No subreddits found. Collect posts first.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Subreddits Section for Chart Tab (auto-closes sidebar) */}
            {activeTab === 'chart' && (
              <div className="space-y-3 border border-[#2A2A33] rounded-[8px] overflow-hidden">
                <button
                  onClick={() => toggleSection('subreddits')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#18181F] hover:bg-[#1E1E28] transition-colors"
                >
                  <h3 className="text-[13px] font-bold text-[#E6E6EB] uppercase tracking-wide">
                    Subreddits
                  </h3>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A1A1AA] transition-transform duration-200 ${
                      expandedSections.subreddits ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.subreddits && (
                  <div className="px-3 pb-3 max-h-96 overflow-y-auto">
                    {isLoadingSubreddits ? (
                      <div className="text-center text-[#A1A1AA] text-sm py-4">Loading...</div>
                    ) : subreddits.length > 0 ? (
                      <div className="space-y-2">
                        {subreddits.map((subreddit) => (
                          <button
                            key={subreddit}
                            onClick={() => { setSelectedSubreddit(subreddit); setSidebarOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-[8px] text-sm transition-all ${
                              selectedSubreddit === subreddit
                                ? 'bg-[#FF3B3B] text-white shadow-lg shadow-[#FF3B3B]/20'
                                : 'bg-[#0B0B0F] border border-[#2A2A33] text-[#A1A1AA] hover:text-[#E6E6EB] hover:border-[#FF3B3B]/20'
                            }`}
                          >
                            r/{subreddit}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-[#A1A1AA] text-sm py-4">
                        No subreddits found. Collect posts first.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Subreddit Groups Section for Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-3 border border-[#2A2A33] rounded-[8px] overflow-hidden">
                <button
                  onClick={() => toggleSection('groups')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#18181F] hover:bg-[#1E1E28] transition-colors"
                >
                  <h3 className="text-[13px] font-bold text-[#E6E6EB] uppercase tracking-wide">
                    Groups
                  </h3>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A1A1AA] transition-transform duration-200 ${
                      expandedSections.groups ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.groups && (
                  <div className="px-3 pb-3 space-y-3">
                    {/* Existing groups */}
                    {subredditGroups.length > 0 ? (
                      <div className="space-y-2">
                        {subredditGroups.map((group) => (
                          <div
                            key={group.id}
                            className={`rounded-[8px] border transition-all ${
                              selectedSubredditGroup === group.id
                                ? 'border-[#FF3B3B]/40 bg-[#FF3B3B]/5'
                                : 'border-[#2A2A33] bg-[#0B0B0F]'
                            }`}
                          >
                            <button
                              onClick={() => setSelectedSubredditGroup(selectedSubredditGroup === group.id ? null : group.id)}
                              className="w-full text-left px-3 py-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-sm font-medium ${
                                  selectedSubredditGroup === group.id ? 'text-[#FF3B3B]' : 'text-[#E6E6EB]'
                                }`}>{group.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSubredditGroups(prev => prev.filter(g => g.id !== group.id)); if (selectedSubredditGroup === group.id) setSelectedSubredditGroup(null); }}
                                    className="p-1 text-[#A1A1AA] hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {group.subreddits.map(s => (
                                  <span key={s} className="text-[11px] text-[#A1A1AA] bg-[#18181F] border border-[#2A2A33] rounded px-1.5 py-0.5">
                                    r/{s}
                                  </span>
                                ))}
                              </div>
                            </button>
                            {selectedSubredditGroup === group.id && (
                              <div className="mx-3 mb-3 px-3 py-2 rounded-[6px] bg-[#18181F] border border-[#FF3B3B]/20 text-[12px] text-[#A1A1AA] text-center">
                                🚧 Group selecting coming soon
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : !isCreatingGroup ? (
                      <p className="text-center text-[#A1A1AA] text-xs py-2">No groups yet.</p>
                    ) : null}

                    {/* Create group form */}
                    {isCreatingGroup ? (
                      <div className="border border-[#2A2A33] rounded-[8px] bg-[#0B0B0F] p-3 space-y-3">
                        <input
                          type="text"
                          placeholder="Group name"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          className="w-full bg-[#18181F] border border-[#2A2A33] rounded-[6px] px-3 py-2 text-sm text-[#E6E6EB] placeholder-[#52525B] focus:outline-none focus:border-[#FF3B3B] focus:ring-1 focus:ring-[#FF3B3B]/30 transition-all"
                          autoFocus
                        />
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-[#A1A1AA] uppercase tracking-wide">Select Subreddits</p>
                          {subreddits.length > 0 ? (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {subreddits.map(s => (
                                <label key={s} className="flex items-center gap-2.5 px-2 py-1.5 rounded-[6px] hover:bg-[#18181F] cursor-pointer transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={newGroupSubreddits.has(s)}
                                    onChange={(e) => {
                                      const next = new Set(newGroupSubreddits);
                                      e.target.checked ? next.add(s) : next.delete(s);
                                      setNewGroupSubreddits(next);
                                    }}
                                    className="accent-[#FF3B3B] w-3.5 h-3.5"
                                  />
                                  <span className="text-sm text-[#A1A1AA]">r/{s}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[#52525B]">No subreddits available.</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!newGroupName.trim() || newGroupSubreddits.size === 0) return;
                              const group = { id: crypto.randomUUID(), name: newGroupName.trim(), subreddits: Array.from(newGroupSubreddits) };
                              setSubredditGroups(prev => [...prev, group]);
                              setNewGroupName('');
                              setNewGroupSubreddits(new Set());
                              setIsCreatingGroup(false);
                            }}
                            disabled={!newGroupName.trim() || newGroupSubreddits.size === 0}
                            className="flex-1 py-2 rounded-[6px] text-sm font-medium bg-[#FF3B3B] text-white hover:bg-[#e63535] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Create
                          </button>
                          <button
                            onClick={() => { setIsCreatingGroup(false); setNewGroupName(''); setNewGroupSubreddits(new Set()); }}
                            className="flex-1 py-2 rounded-[6px] text-sm font-medium bg-[#18181F] border border-[#2A2A33] text-[#A1A1AA] hover:text-[#E6E6EB] hover:border-[#A1A1AA]/40 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsCreatingGroup(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-[6px] text-sm text-[#A1A1AA] hover:text-[#E6E6EB] border border-dashed border-[#2A2A33] hover:border-[#FF3B3B]/40 hover:bg-[#FF3B3B]/5 transition-all"
                      >
                        <span className="text-lg leading-none">+</span>
                        <span>New Group</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Metrics Section for Chart Tab */}
            {activeTab === 'chart' && (
              <div className="space-y-3 border border-[#2A2A33] rounded-[8px] overflow-hidden">
                <button
                  onClick={() => toggleSection('metrics')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#18181F] hover:bg-[#1E1E28] transition-colors"
                >
                  <h3 className="text-[13px] font-bold text-[#E6E6EB] uppercase tracking-wide">
                    Metrics
                  </h3>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A1A1AA] transition-transform duration-200 ${
                      expandedSections.metrics ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.metrics && (
                  <div className="px-3 pb-3 space-y-4">
                    <div>
                      <label htmlFor="metric-select" className="block text-xs text-[#A1A1AA] font-medium mb-2 uppercase tracking-wide">
                        Select Embeddin Metric
                      </label>
                      <select
                        id="metric-select"
                        value={selectedMetric}
                        onChange={(e) => setSelectedMetric(e.target.value as 'ai' | 'pain' | 'advice' | 'narrative')}
                        className="w-full bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] px-3 py-2.5 text-sm text-[#E6E6EB] focus:outline-none focus:border-[#FF3B3B] focus:ring-1 focus:ring-[#FF3B3B]/30 transition-all"
                      >
                        <option value="ai">🔵 AI Summary</option>
                        <option value="pain">🟡 Pain</option>
                        <option value="advice">🟢 Advice</option>
                        <option value="narrative">🔷 Narrative</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[#A1A1AA] font-medium mb-2 uppercase tracking-wide">
                        Highlight Tag
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'pain_conveying', label: '🟡 Pain', color: 'rgba(255,184,77,0.85)' },
                          { key: 'advice_solution', label: '🟢 Advice', color: 'rgba(102,187,106,0.85)' },
                          { key: 'narrative_experience', label: '🔷 Narrative', color: 'rgba(66,165,245,0.85)' },
                        ].map(({ key, label, color }) => (
                          <button
                            key={key}
                            onClick={() => setHighlightTag(prev => {
                                const next = new Set(prev);
                                next.has(key) ? next.delete(key) : next.add(key);
                                return next;
                              })}
                            className={`px-2 py-1 rounded-[6px] text-xs font-medium transition-all border ${
                              highlightTag.has(key)
                                ? 'border-transparent text-[#0B0B0F]'
                                : 'border-[#2A2A33] text-[#A1A1AA] bg-transparent hover:border-[#3A3A43]'
                            }`}
                            style={highlightTag.has(key) ? { backgroundColor: color } : {}}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {highlightTag.size > 0 && (
                        <p className="text-xs text-[#6A6A73] mt-1.5">Posts without this tag are dimmed</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="color-metric" className="block text-xs text-[#A1A1AA] font-medium mb-2 uppercase tracking-wide">
                        Color Intensity By
                      </label>
                      <select
                        id="color-metric"
                        value={selectedColorMetric}
                        onChange={(e) => setSelectedColorMetric(e.target.value as 'none' | 'comments' | 'ups' | 'date' | 'upvote_ratio')}
                        className="w-full bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] px-3 py-2.5 text-sm text-[#E6E6EB] focus:outline-none focus:border-[#FF3B3B] focus:ring-1 focus:ring-[#FF3B3B]/30 transition-all"
                      >
                        <option value="none">None</option>
                        <option value="comments">💬 Comments</option>
                        <option value="ups">👍 Upvotes</option>
                        <option value="upvote_ratio">📉 Upvote Ratio (lower = darker)</option>
                        <option value="date">📅 Date (newer = darker)</option>
                      </select>
                      <p className="text-xs text-[#6A6A73] mt-2">
                        {selectedColorMetric === 'comments' && 'Darker = More comments'}
                        {selectedColorMetric === 'ups' && 'Darker = More upvotes'}
                        {selectedColorMetric === 'upvote_ratio' && 'Darker = Lower upvote ratio'}
                        {selectedColorMetric === 'date' && 'Darker = More recent'}
                        {selectedColorMetric === 'none' && 'Solid color by metric'}
                      </p>
                    </div>

                    {isLoadingChart && (
                      <div className="text-center text-[#A1A1AA] text-xs py-2">
                        Loading embeddings...
                      </div>
                    )}

                    {!isLoadingChart && selectedSubreddit && (
                      <div className="text-xs text-[#6A6A73] bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] p-2">
                        Showing <span className="text-[#E6E6EB]">{selectedMetric}</span> embeddings for <span className="text-[#E6E6EB]">r/{selectedSubreddit}</span>{selectedColorMetric !== 'none' && <span> <span className="text-[#E6E6EB]">(colored by {selectedColorMetric})</span></span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Clustering Section for Chart Tab */}
            {activeTab === 'chart' && (
              <div className="space-y-3 border border-[#2A2A33] rounded-[8px] overflow-hidden">
                <button
                  onClick={() => toggleSection('clustering')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#18181F] hover:bg-[#1E1E28] transition-colors"
                >
                  <h3 className="text-[13px] font-bold text-[#E6E6EB] uppercase tracking-wide">
                    Clustering
                  </h3>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A1A1AA] transition-transform duration-200 ${
                      expandedSections.clustering ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.clustering && (
                  <div className="px-3 pb-3 space-y-3">
                    {/* Clustering Controls */}
                    <div className="space-y-2">
                      <label htmlFor="num-clusters" className="block text-xs text-[#A1A1AA] font-medium uppercase tracking-wide">
                        Number of Clusters
                      </label>
                      <div className="space-y-2">
                        <input
                          id="num-clusters"
                          type="text"
                          value={numClusters}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 3;
                            setNumClusters(Math.max(2, val));
                          }}
                          className="w-full bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] px-3 py-2 text-sm text-[#E6E6EB] focus:outline-none focus:border-[#FF3B3B] focus:ring-1 focus:ring-[#FF3B3B]/30"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleAutoDetectK}
                            disabled={isDetectingK || embeddingPoints.length === 0}
                            className="flex-1 px-4 py-2 bg-[#2A2A33] text-white text-sm font-semibold rounded-[8px] hover:bg-[#3A3A43] disabled:opacity-50 disabled:cursor-not-allowed transition-all border border-[#3A3A43]"
                            title="Auto-detect optimal number of clusters using Gap Statistic"
                          >
                            {isDetectingK ? 'Detecting...' : 'Auto Detect'}
                          </button>
                          <button
                            onClick={handleCluster}
                            disabled={isClusteringLoading || embeddingPoints.length === 0}
                            className="flex-1 px-4 py-2 bg-[#FF3B3B] text-white text-sm font-semibold rounded-[8px] hover:bg-[#E32B2B] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {isClusteringLoading ? 'Clustering...' : 'Cluster'}
                          </button>
                        </div>
                        {detectedK && (
                          <div className="text-xs text-[#A1A1AA] bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] p-2">
                            Detected K: <span className="text-[#FF3B3B]">{detectedK}</span> {numClusters === detectedK && '✓'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Groups List */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs text-[#A1A1AA] font-medium uppercase tracking-wide">
                          Groups ({Object.keys(clusterAssignments).length > 0 ? Object.keys(getGroupedPosts()).length : 1})
                        </h4>
                        {Object.keys(clusterAssignments).length > 0 && (
                          <>
                            <button
                              onClick={() => {
                                const sortMethods: ('posts' | 'comments' | 'ups')[] = ['posts', 'comments', 'ups'];
                                const currentIndex = sortMethods.indexOf(groupSortBy);
                                setGroupSortBy(sortMethods[(currentIndex + 1) % sortMethods.length]);
                              }}
                              className="text-[#A1A1AA] hover:text-[#FF3B3B] transition-colors"
                              title={`Sort by: ${groupSortBy === 'posts' ? 'Posts (click to sort by Comments)' : groupSortBy === 'comments' ? 'Comments (click to sort by Ups)' : 'Ups (click to sort by Posts)'}`}
                            >
                              {groupSortBy === 'posts' && <Layers size={16} />}
                              {groupSortBy === 'comments' && <MessageCircle size={16} />}
                              {groupSortBy === 'ups' && <TrendingUp size={16} />}
                            </button>
                            <button
                              onClick={generateClusterNames}
                              disabled={isNamingClusters}
                              className="text-[#A1A1AA] hover:text-[#FF3B3B] transition-colors disabled:opacity-50"
                              title="Generate AI-based cluster names"
                            >
                              <Sparkles size={16} />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {Object.keys(clusterAssignments).length === 0 ? (
                          <div className="bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] p-2">
                            <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                              <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                              <span>Unassigned ({embeddingPoints.length})</span>
                            </div>
                          </div>
                        ) : (
                          getSortedGroupEntries().map(([groupName, posts]) => {
                            const isHidden = hiddenClusters.has(groupName);
                            const isFocused = focusedCluster === groupName;
                            const isEditing = editingCluster === groupName;
                            const displayName = manualClusterNames[groupName] || clusterNames[groupName] || `Cluster ${groupName.replace('cluster_', '')}`;
                            
                            return (
                              <div key={groupName} className="bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] p-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  {groupName !== 'unassigned' && (
                                    <button
                                      onClick={() => setHighlightedClusters(prev => {
                                        const newSet = new Set(prev);
                                        if (newSet.has(groupName)) {
                                          newSet.delete(groupName);
                                        } else {
                                          newSet.add(groupName);
                                        }
                                        return newSet;
                                      })}
                                      className={`w-3 h-3 rounded-full cursor-pointer transition-all ${highlightedClusters.has(groupName) ? 'ring-2 ring-[#FF3B3B] scale-150' : 'hover:scale-125'}`}
                                      style={{
                                        backgroundColor: getColorForCluster(
                                          parseInt(groupName.replace('cluster_', ''))
                                        ).replace('0.7', '1'),
                                      }}
                                      title="Click to highlight this group on chart"
                                    ></button>
                                  )}
                                  {groupName === 'unassigned' && (
                                    <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                                  )}
                                  <div className="flex-1">
                                    {isEditing ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={manualClusterNames[groupName] || clusterNames[groupName] || `Cluster ${groupName.replace('cluster_', '')}`}
                                        onChange={(e) => setManualClusterNames({ ...manualClusterNames, [groupName]: e.target.value })}
                                        onBlur={() => setEditingCluster(null)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') setEditingCluster(null);
                                          if (e.key === 'Escape') setEditingCluster(null);
                                        }}
                                        className="w-full bg-[#1A1A23] border border-[#FF3B3B] rounded px-2 py-1 text-xs text-[#E6E6EB] focus:outline-none"
                                      />
                                    ) : (
                                      <span className={`capitalize text-xs text-[#A1A1AA] ${isHidden ? 'opacity-50' : ''}`}>
                                        {displayName} (
                                        {groupSortBy === 'posts'
                                          ? posts.length
                                          : groupSortBy === 'comments'
                                          ? posts.reduce((sum, p) => sum + (p.comments || 0), 0)
                                          : posts.reduce((sum, p) => sum + (p.ups || 0), 0)}
                                        )
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {groupName !== 'unassigned' && (
                                  <div className="flex gap-1 justify-end">
                                    <button
                                      onClick={() => handleGroupSelect(groupName)}
                                      className="text-[#A1A1AA] hover:text-[#FF3B3B] transition-colors p-1"
                                      title="View group details"
                                    >
                                      <Info size={14} />
                                    </button>
                                    <button
                                      onClick={() => setEditingCluster(editingCluster === groupName ? null : groupName)}
                                      className="text-[#A1A1AA] hover:text-[#FF3B3B] transition-colors p-1"
                                      title="Edit name"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => setHiddenClusters(prev => {
                                        const newSet = new Set(prev);
                                        isHidden ? newSet.delete(groupName) : newSet.add(groupName);
                                        return newSet;
                                      })}
                                      className="text-[#A1A1AA] hover:text-[#FF3B3B] transition-colors p-1"
                                      title={isHidden ? 'Show group' : 'Hide group'}
                                    >
                                      {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                    <button
                                      onClick={() => setFocusedCluster(isFocused ? null : groupName)}
                                      className={`${isFocused ? 'text-[#FF3B3B]' : 'text-[#A1A1AA]'} hover:text-[#FF3B3B] transition-colors p-1`}
                                      title={isFocused ? 'Show all groups' : 'Focus on this group'}
                                    >
                                      <Target size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveGroup(groupName)}
                                      className="text-[#FF6B6B] hover:text-[#FF3B3B] transition-colors p-1"
                                      title="Delete group"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Section for Chart Tab */}
            {activeTab === 'chart' && (
              <div className="space-y-3 border border-[#2A2A33] rounded-[8px] overflow-hidden">
                <button
                  onClick={() => toggleSection('search')}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#18181F] hover:bg-[#1E1E28] transition-colors"
                >
                  <h3 className="text-[13px] font-bold text-[#E6E6EB] uppercase tracking-wide">
                    Search
                  </h3>
                  <ChevronDown
                    className={`w-4 h-4 text-[#A1A1AA] transition-transform duration-200 ${
                      expandedSections.search ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSections.search && (
                  <div className="px-3 pb-3 space-y-4">
                    {/* Search Type Selection */}
                    <div>
                      <label className="block text-xs text-[#A1A1AA] font-medium mb-2 uppercase tracking-wide">
                        Search Type
                      </label>
                      <div className="space-y-2">
                        <button
                          onClick={() => setSearchType('exact')}
                          className={`w-full px-3 py-2.5 rounded-[8px] text-sm font-semibold transition-all ${
                            searchType === 'exact'
                              ? 'bg-[#FF3B3B] text-white shadow-lg shadow-[#FF3B3B]/20'
                              : 'bg-[#0B0B0F] border border-[#2A2A33] text-[#A1A1AA] hover:text-[#E6E6EB] hover:border-[#FF3B3B]/20'
                          }`}
                        >
                          🔍 Exact Search
                        </button>
                        <button
                          onClick={() => setSearchType('semantic')}
                          className={`w-full px-3 py-2.5 rounded-[8px] text-sm font-semibold transition-all ${
                            searchType === 'semantic'
                              ? 'bg-[#FF3B3B] text-white shadow-lg shadow-[#FF3B3B]/20'
                              : 'bg-[#0B0B0F] border border-[#2A2A33] text-[#A1A1AA] hover:text-[#E6E6EB] hover:border-[#FF3B3B]/20'
                          }`}
                        >
                          ✨ Semantic Search
                        </button>
                      </div>
                    </div>

                    {/* Search Query Input */}
                    <div>
                      <label htmlFor="search-query" className="block text-xs text-[#A1A1AA] font-medium mb-2 uppercase tracking-wide">
                        Query
                      </label>
                      <input
                        id="search-query"
                        type="text"
                        placeholder={searchType === 'exact' ? 'Enter keywords...' : 'Enter search query...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] px-3 py-2.5 text-sm text-[#E6E6EB] placeholder-[#6A6A73] focus:outline-none focus:border-[#FF3B3B] focus:ring-1 focus:ring-[#FF3B3B]/30 transition-all"
                      />
                    </div>

                    {/* Search Button */}
                    <button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || !selectedSubreddit || isSearching}
                      className="w-full px-4 py-2.5 bg-[#FF3B3B] text-white text-sm font-semibold rounded-[8px] hover:bg-[#E32B2B] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      title="Search posts"
                    >
                      <Search size={16} />
                      {isSearching ? 'Searching...' : 'Search'}
                    </button>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs text-[#A1A1AA] font-medium uppercase tracking-wide">
                            Results ({searchResults.length})
                          </h4>
                          <div className="flex items-center gap-1">
                            {searchType === 'semantic' && (
                              <button
                                onClick={handleComputeApproximateLocation}
                                disabled={isSearching}
                                className="text-xs text-[#6A6A73] hover:text-[#FF3B3B] transition-colors disabled:opacity-50"
                                title="Compute query position on chart relative to all posts"
                              >
                                📍 Locate
                              </button>
                            )}
                            <button
                              onClick={handleClearSearch}
                              className="text-[#A1A1AA] hover:text-[#FF3B3B] transition-colors"
                              title="Clear search"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {getSortedSearchResults().map((post: any) => (
                            <div
                              key={post.post_id}
                              className="bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] p-2 hover:border-[#FF3B3B]/30 transition-all group"
                            >
                              <div className="flex items-start gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePostHighlight(post.post_id);
                                  }}
                                  className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 transition-all cursor-pointer ${
                                    highlightedPostIds.has(post.post_id)
                                      ? 'bg-[#FF3B3B] ring-2 ring-[#FF3B3B] scale-125'
                                      : 'bg-[#3A3A43] group-hover:bg-[#FF3B3B]/50'
                                  }`}
                                  title="Toggle highlight on chart"
                                ></button>
                                <div 
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => handleSearchResultSelect(post)}
                                >
                                  <p className="text-xs text-[#E6E6EB] font-medium truncate group-hover:text-[#FF3B3B] transition-colors">
                                    {post.title}
                                  </p>
                                  <p className="text-xs text-[#6A6A73] truncate mt-0.5">
                                    {post.ups} 👍 {post.comments} 💬
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {searchResults.length > displayedResultsCount && (
                          <button
                            onClick={() => setDisplayedResultsCount(displayedResultsCount + 10)}
                            className="w-full text-xs text-[#A1A1AA] hover:text-[#FF3B3B] bg-[#1A1A24] border border-[#2A2A33] rounded-[6px] py-2 transition-colors mt-2"
                          >
                            Show More ({displayedResultsCount} of {searchResults.length})
                          </button>
                        )}
                        <button
                          onClick={handleKeepOnlySearchResults}
                          className="w-full text-xs text-[#E6E6EB] bg-[#FF3B3B] hover:bg-[#E32B2B] rounded-[6px] py-2.5 transition-colors font-semibold mt-2"
                          title="Remove all points except search results from chart"
                        >
                          Keep Only Results
                        </button>
                      </div>
                    )}

                    {/* Search Type Info */}
                    <div className="text-xs text-[#6A6A73] bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] p-2">
                      {searchType === 'exact' && 'Find posts with exact keyword matches'}
                      {searchType === 'semantic' && 'Find conceptually similar posts using embeddings'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <section className="flex-1 overflow-hidden w-full">
        {activeTab === 'overview' ? (
          <div className="h-full overflow-auto p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-[#E6E6EB] mb-2">Overview</h1>
            {selectedSubreddit && (
              <div className="flex items-center gap-2 mb-8">
                <span className="text-lg text-[#A1A1AA]">r/{selectedSubreddit}</span>
                <a
                  href={`https://reddit.com/r/${selectedSubreddit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#FF3B3B] hover:text-[#E32B2B] transition-colors text-sm font-medium"
                >
                  Visit on Reddit ↗
                </a>
              </div>
            )}
            
            {!selectedSubreddit ? (
              <div className="bg-[#18181F] border border-[#2A2A33] rounded-[14px] p-8 text-center">
                <p className="text-[#A1A1AA]">Select a subreddit from the sidebar to view overview</p>
              </div>
            ) : isLoadingOverview ? (
              <div className="bg-[#18181F] border border-[#2A2A33] rounded-[14px] p-8 text-center">
                <p className="text-[#A1A1AA]">Loading overview data...</p>
              </div>
            ) : overviewData ? (
              <div className="space-y-4 sm:space-y-6">
                {/* Data Statistics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {/* Total Posts Card */}
                  <div className="bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4">
                    <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-2">Total Posts</div>
                    <div className="text-3xl font-bold text-[#E6E6EB]">{overviewData.totalPosts}</div>
                  </div>

                  {/* Date Range Card */}
                  <div className="bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4">
                    <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-2">Date Range</div>
                    <div className="space-y-0.5">
                      {overviewData.minDate && overviewData.maxDate ? (
                        <>
                          <div className="text-[#E6E6EB] text-xs font-medium">
                            {overviewData.minDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-[#A1A1AA] text-xs">to</div>
                          <div className="text-[#E6E6EB] text-xs font-medium">
                            {overviewData.maxDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        </>
                      ) : (
                        <div className="text-[#A1A1AA] text-xs">No data</div>
                      )}
                    </div>
                  </div>

                  {/* Calibration Status Card */}
                  <div className="bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4">
                    <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-2">Calibration Status</div>
                    {overviewData.calibrationStatus.isDone ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#4CAF50]"></div>
                        <div className="text-xs">
                          <div className="text-[#E6E6EB] font-medium">Completed</div>
                          <div className="text-[#A1A1AA] text-[11px]">
                            {overviewData.calibrationStatus.calibrated} / {overviewData.calibrationStatus.total}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-[#FF9800] flex-shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <div className="text-[#E6E6EB] font-medium">Not Calibrated</div>
                            <div className="text-[#A1A1AA] text-[11px]">
                              {overviewData.calibrationStatus.calibrated} / {overviewData.calibrationStatus.total}
                            </div>
                          </div>
                        </div>
                        <Link
                          href="/collecting"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#FF3B3B] text-white text-[11px] font-semibold rounded-[6px] hover:bg-[#E32B2B] transition-all duration-200"
                        >
                          Collect
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Search Card */}
                <div className="bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4 mt-6">
                  <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-4">Search Posts</div>
                  <div className="space-y-4">
                    {/* Input Field */}
                    <div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Enter search term..."
                        className="w-full px-4 py-2.5 bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] text-[#E6E6EB] placeholder-[#6B6B75] focus:outline-none focus:border-[#FF3B3B] transition-colors text-sm"
                      />
                    </div>

                    {/* Search Type Selection */}
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="searchType"
                          value="exact"
                          checked={searchType === 'exact'}
                          onChange={(e) => setSearchType(e.target.value as 'exact' | 'semantic')}
                          className="w-4 h-4 accent-[#FF3B3B]"
                        />
                        <span className="text-[#A1A1AA] text-sm font-medium">Exact Match</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="searchType"
                          value="semantic"
                          checked={searchType === 'semantic'}
                          onChange={(e) => setSearchType(e.target.value as 'exact' | 'semantic')}
                          className="w-4 h-4 accent-[#FF3B3B]"
                        />
                        <span className="text-[#A1A1AA] text-sm font-medium">Semantic</span>
                        <Sparkles className="w-3.5 h-3.5 text-[#FF3B3B]" />
                      </label>
                    </div>

                    {/* Search Button */}
                    <button
                      disabled={!searchQuery.trim() || isSearching || !selectedSubreddit}
                      onClick={() => {
                        if (searchQuery.trim() && selectedSubreddit) {
                          router.push(`/insight/chart?subreddit=${selectedSubreddit}&query=${encodeURIComponent(searchQuery)}&type=${searchType}`);
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-[#FF3B3B] text-white text-sm font-semibold rounded-[8px] hover:bg-[#E32B2B] disabled:bg-[#6B6B75] disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {isSearching ? 'Searching...' : 'Search on Chart'}
                    </button>
                  </div>
                </div>

                {/* Posts Over Time Chart */}
                {postsOverTimeData && (
                  <div className="bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4 mt-6">
                    <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-4">Posts Over Time</div>
                    <div className="h-96">
                      <Chart 
                        type="line" 
                        data={postsOverTimeData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          interaction: {
                            intersect: false,
                            mode: 'index',
                          },
                          plugins: {
                            legend: {
                              display: true,
                              labels: {
                                color: '#A1A1AA',
                                font: { size: 12 },
                                usePointStyle: true,
                              },
                            },
                            tooltip: {
                              backgroundColor: '#18181F',
                              titleColor: '#E6E6EB',
                              bodyColor: '#A1A1AA',
                              borderColor: '#2A2A33',
                              borderWidth: 1,
                              padding: 10,
                              displayColors: false,
                              callbacks: {
                                title: (context: any) => {
                                  if (context.length > 0) {
                                    return context[0].raw.dateStr;
                                  }
                                  return '';
                                },
                                label: (context: any) => {
                                  return `${context.raw.y} post${context.raw.y !== 1 ? 's' : ''}`;
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              type: 'linear',
                              grid: { color: '#2A2A33' },
                              ticks: {
                                color: '#A1A1AA',
                                font: { size: 11 },
                                callback: function (value: any) {
                                  const date = new Date(value);
                                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                },
                              },
                            },
                            y: {
                              grid: { color: '#2A2A33' },
                              ticks: {
                                color: '#A1A1AA',
                                font: { size: 11 },
                                stepSize: 1,
                              },
                            },
                          },
                        } as ChartOptions}
                      />
                    </div>
                  </div>
                )}

                {/* Entity Trend + Top Entities + Top Platforms Row */}
                {(entityTrendData || topEntitiesData.length > 0 || topPlatformsData.length > 0) && (
                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Entity Trend Over Time Chart */}
                    {entityTrendData && (
                      <div className="flex-[3] bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4 min-w-0">
                        <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-4">Entity Trend Over Time</div>
                        <div className="h-96">
                          <Chart
                            type="line"
                            data={entityTrendData}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              interaction: {
                                intersect: false,
                                mode: 'index',
                              },
                              plugins: {
                                legend: {
                                  display: true,
                                  labels: {
                                    color: '#A1A1AA',
                                    font: { size: 11 },
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                  },
                                },
                                tooltip: {
                                  backgroundColor: '#18181F',
                                  titleColor: '#E6E6EB',
                                  bodyColor: '#A1A1AA',
                                  borderColor: '#2A2A33',
                                  borderWidth: 1,
                                  padding: 10,
                                  callbacks: {
                                    title: (context: any) => {
                                      if (context.length > 0) {
                                        return context[0].raw.dateStr;
                                      }
                                      return '';
                                    },
                                    label: (context: any) => {
                                      return `${context.dataset.label}: ${context.raw.y} mention${context.raw.y !== 1 ? 's' : ''}`;
                                    },
                                  },
                                },
                              },
                              scales: {
                                x: {
                                  type: 'linear',
                                  grid: { color: '#2A2A33' },
                                  ticks: {
                                    color: '#A1A1AA',
                                    font: { size: 11 },
                                    callback: function (value: any) {
                                      const date = new Date(value);
                                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    },
                                  },
                                },
                                y: {
                                  grid: { color: '#2A2A33' },
                                  ticks: {
                                    color: '#A1A1AA',
                                    font: { size: 11 },
                                    stepSize: 1,
                                  },
                                },
                              },
                            } as ChartOptions}
                          />
                        </div>
                      </div>
                    )}

                    {/* Top Entities Leaderboard */}
                    {topEntitiesData.length > 0 && (
                      <div className="flex-1 bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4 min-w-0">
                        <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-4">Top Entities</div>
                        <div className="h-64 sm:h-96 overflow-y-auto space-y-1.5 pr-1">
                          {topEntitiesData.map((entity, idx) => {
                            const maxCount = topEntitiesData[0]?.count || 1;
                            const widthPct = Math.max(8, (entity.count / maxCount) * 100);
                            return (
                              <div key={entity.name} className="flex items-center gap-2.5">
                                <span className="text-[11px] text-[#52525B] w-5 text-right font-mono">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[13px] text-[#E6E6EB] truncate" title={entity.name}>{entity.name}</span>
                                    <span className="text-[11px] text-[#A1A1AA] font-mono ml-2 flex-shrink-0">{entity.count}</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-[#2A2A33]">
                                    <div
                                      className="h-1 rounded-full bg-[#FF3B3B] transition-all"
                                      style={{ width: `${widthPct}%`, opacity: 0.4 + (entity.count / maxCount) * 0.6 }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Top Platforms Leaderboard */}
                    {topPlatformsData.length > 0 && (
                      <div className="flex-1 bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4 min-w-0">
                        <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-4">Top Platforms</div>
                        <div className="h-64 sm:h-96 overflow-y-auto space-y-1.5 pr-1">
                          {topPlatformsData.map((item, idx) => {
                            const maxCount = topPlatformsData[0]?.count || 1;
                            const widthPct = Math.max(8, (item.count / maxCount) * 100);
                            return (
                              <div key={item.platform} className="flex items-center gap-2.5">
                                <span className="text-[11px] text-[#52525B] w-5 text-right font-mono">{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[13px] text-[#E6E6EB] truncate" title={item.platform}>{item.platform}</span>
                                    <span className="text-[11px] text-[#A1A1AA] font-mono ml-2 flex-shrink-0">{item.count}</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-[#2A2A33]">
                                    <div
                                      className="h-1 rounded-full bg-[#6BC2FF] transition-all"
                                      style={{ width: `${widthPct}%`, opacity: 0.4 + (item.count / maxCount) * 0.6 }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Entity Co-occurrence */}
                {entityCooccurrenceData.length > 0 && (
                  <div className="bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4">
                    <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-4">Often Mentioned Together</div>
                    <div className="flex flex-wrap gap-2">
                      {entityCooccurrenceData.map((pair, idx) => {
                        const maxCount = entityCooccurrenceData[0]?.count || 1;
                        const opacity = 0.4 + (pair.count / maxCount) * 0.6;
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 bg-[#0B0B0F] border border-[#2A2A33] rounded-[8px] px-3 py-2 hover:border-[#3A3A43] transition-colors"
                            style={{ opacity }}
                          >
                            <span className="text-[13px] text-[#E6E6EB]">{pair.a}</span>
                            <span className="text-[11px] text-[#52525B]">×</span>
                            <span className="text-[13px] text-[#E6E6EB]">{pair.b}</span>
                            <span className="text-[10px] text-[#A1A1AA] font-mono ml-1 bg-[#18181F] rounded px-1.5 py-0.5">{pair.count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Embeddings Visualization — 2D + 3D side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* 2D Chart */}
                  <div className="bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide">Embeddings Visualization</div>
                    {overviewEmbeddingData && (
                      <Link
                        href={`/insight/chart?subreddit=${selectedSubreddit}`}
                        className="text-[#FF3B3B] hover:text-[#E32B2B] transition-colors text-xs font-medium"
                      >
                        Full Chart ↗
                      </Link>
                    )}
                  </div>
                  <div className={`h-96 relative ${!overviewEmbeddingData && !isLoadingOverviewEmbeddings ? 'opacity-40 pointer-events-none' : ''}`}>
                    {isLoadingOverviewEmbeddings ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-[#A1A1AA]">Loading embeddings...</p>
                      </div>
                    ) : overviewEmbeddingData ? (
                      <Chart 
                        type="scatter" 
                        data={{
                          ...overviewEmbeddingData,
                          datasets: overviewEmbeddingData.datasets.map((ds: any) => ({
                            ...ds,
                            backgroundColor: overviewTimelineEnabled && overviewTimelineBounds
                              ? (context: any) => {
                                  const point = ds.data[context.dataIndex];
                                  const dateIdx = Math.round((overviewTimelinePos / 100) * (overviewTimelineBounds.dates.length - 1));
                                  const activeDate = overviewTimelineBounds.dates[dateIdx];
                                  const postDate = point?.created ? new Date(point.created).toISOString().slice(0, 10) : null;
                                  return postDate === activeDate ? 'rgba(156, 39, 176, 0.85)' : 'rgba(80, 80, 80, 0.08)';
                                }
                              : 'rgba(156, 39, 176, 0.6)',
                          }))
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          interaction: {
                            intersect: false,
                            mode: 'nearest',
                          },
                          plugins: {
                            legend: {
                              display: true,
                              labels: {
                                color: '#A1A1AA',
                                font: { size: 12 },
                                usePointStyle: true,
                              },
                            },
                            tooltip: {
                              backgroundColor: '#18181F',
                              titleColor: '#E6E6EB',
                              bodyColor: '#A1A1AA',
                              borderColor: '#2A2A33',
                              borderWidth: 1,
                              padding: 12,
                              displayColors: false,
                              callbacks: {
                                title: (context: any) => {
                                  if (context.length > 0) {
                                    return context[0].raw.title || 'Post';
                                  }
                                  return '';
                                },
                                label: (context: any) => {
                                  const point = context.raw;
                                  return [
                                    `X: ${point.x?.toFixed(2) || 'N/A'}`,
                                    `Y: ${point.y?.toFixed(2) || 'N/A'}`,
                                    ...(point.author ? [`Author: ${point.author}`] : []),
                                    ...(point.comments !== undefined ? [`Comments: ${point.comments}`] : []),
                                    ...(point.ups !== undefined ? [`Upvotes: ${point.ups}`] : []),
                                  ];
                                },
                              },
                            },
                          },
                          scales: {
                            x: {
                              type: 'linear',
                              position: 'bottom',
                              grid: { color: '#2A2A33' },
                              ticks: {
                                color: '#A1A1AA',
                                font: { size: 11 },
                              },
                            },
                            y: {
                              grid: { color: '#2A2A33' },
                              ticks: {
                                color: '#A1A1AA',
                                font: { size: 11 },
                              },
                            },
                          },
                        } as ChartOptions}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-[#A1A1AA] text-sm">Finish calibration to view data</p>
                      </div>
                    )}
                  </div>

                  {/* Overview Timeline Slider */}
                  {overviewTimelineBounds && overviewTimelineBounds.dates.length > 1 && (
                    <div className="px-0 pb-0 pt-3">
                      <div className="flex items-center gap-3 mb-2">
                        <button
                          onClick={() => setOverviewTimelineEnabled(e => !e)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-[6px] border transition-all ${
                            overviewTimelineEnabled
                              ? 'border-[#FF3B3B] text-[#FF3B3B] bg-[#FF3B3B]/10'
                              : 'border-[#2A2A33] text-[#A1A1AA] hover:border-[#3A3A43]'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${overviewTimelineEnabled ? 'bg-[#FF3B3B]' : 'bg-[#3A3A43]'}`} />
                          Timeline
                        </button>
                        {overviewTimelineEnabled && (() => {
                          const dateIdx = Math.round((overviewTimelinePos / 100) * (overviewTimelineBounds.dates.length - 1));
                          const activeDate = overviewTimelineBounds.dates[dateIdx];
                          const postsOnDay = overviewEmbeddingPoints.filter((p: any) =>
                            p.created && new Date(p.created).toISOString().slice(0, 10) === activeDate
                          ).length;
                          return (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[#E6E6EB] font-medium">{new Date(activeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              <span className="text-[#6A6A73]">·</span>
                              <span className="text-[#6A6A73]">{postsOnDay} post{postsOnDay !== 1 ? 's' : ''}</span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="relative h-8 flex items-center gap-2">
                        <span className="text-[10px] text-[#6A6A73] whitespace-nowrap">{new Date(overviewTimelineBounds.dates[0]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                        <div className="relative flex-1 h-8 flex items-center">
                          <div className="absolute w-full h-1 rounded-full bg-[#2A2A33]" />
                          <div
                            className={`absolute w-0.5 h-3 rounded-full transition-colors ${overviewTimelineEnabled ? 'bg-[#FF3B3B]' : 'bg-[#3A3A43]'}`}
                            style={{ left: `calc(${overviewTimelinePos}% - 1px)` }}
                          />
                          <input
                            type="range"
                            min={0} max={100} step={1}
                            value={overviewTimelinePos}
                            onChange={(e) => { setOverviewTimelineEnabled(true); setOverviewTimelinePos(Number(e.target.value)); }}
                            className="absolute w-full h-1 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FF3B3B] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#0B0B0F] [&::-webkit-slider-thumb]:shadow-md"
                          />
                        </div>
                        <span className="text-[10px] text-[#6A6A73] whitespace-nowrap">{new Date(overviewTimelineBounds.dates[overviewTimelineBounds.dates.length - 1]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                      </div>
                    </div>
                  )}
                  </div>

                  {/* 3D Chart */}
                  <div className="bg-[#18181F] border border-[#2A2A33] rounded-[12px] p-4">
                    <div className="text-[#A1A1AA] text-xs font-medium uppercase tracking-wide mb-4">
                      Embeddings 3D
                    </div>
                    <div className="h-96 relative rounded-[8px] overflow-hidden">
                      {isLoading3D ? (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-[#A1A1AA]">Computing 3D projection...</p>
                        </div>
                      ) : overview3DPoints.length > 0 ? (
                        <EmbeddingChart3D points={overview3DPoints} />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <p className="text-[#A1A1AA] text-sm">Finish calibration to view data</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-[#6A6A73] mt-3">Drag to rotate · Scroll to zoom</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#18181F] border border-[#2A2A33] rounded-[14px] p-8 text-center">
                <p className="text-[#A1A1AA]">Unable to load overview data</p>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full w-full bg-[#0B0B0F] flex flex-col">
            {!chartSubreddit ? (
              /* No subreddit selected on chart route */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[#A1A1AA] text-lg mb-4">Select a subreddit from the sidebar to view the chart</p>
                  <p className="text-[#6A6A73] text-sm">Or select a subreddit in the Overview tab and click "Full Chart"</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-4 sm:p-6 lg:p-8 border-b border-[#2A2A33]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold text-[#E6E6EB]">Chart</h1>
                      {selectedSubreddit && (
                        <p className="text-sm text-[#A1A1AA] mt-2">r/{selectedSubreddit}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleUndo}
                        disabled={undoStack.length === 0}
                        className="p-2 rounded-[8px] text-[#A1A1AA] hover:text-[#E6E6EB] hover:bg-[#2A2A33] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        title="Undo (Ctrl+Z)"
                      >
                        <Undo2 size={20} />
                      </button>
                      <button
                        onClick={handleRedo}
                        disabled={redoStack.length === 0}
                        className="p-2 rounded-[8px] text-[#A1A1AA] hover:text-[#E6E6EB] hover:bg-[#2A2A33] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        title="Redo (Ctrl+Y)"
                      >
                        <Redo2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-hidden flex items-center justify-center relative"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!chartRef.current) return;
                    
                    const canvas = (chartRef.current as any).canvas;
                    if (!canvas) return;
                    
                    const rect = canvas.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const clickY = e.clientY - rect.top;
                    
                    // Find the closest point to the right-click position
                    let closestIndex = -1;
                    let closestPixelDistance = Infinity;
                    const pixelThreshold = 15; // 15 pixels = approximately a data point's click radius
                    
                    if (chartData?.datasets[0]?.data) {
                      const chart = (chartRef.current as any);
                      const xScale = chart.scales?.x;
                      const yScale = chart.scales?.y;
                      
                      if (xScale && yScale) {
                        chartData.datasets[0].data.forEach((point: any, index: number) => {
                          // Convert data coordinates to pixel coordinates
                          const pixelX = xScale.getPixelForValue(point.x);
                          const pixelY = yScale.getPixelForValue(point.y);
                          
                          const distance = Math.sqrt(Math.pow(pixelX - clickX, 2) + Math.pow(pixelY - clickY, 2));
                          if (distance < closestPixelDistance) {
                            closestPixelDistance = distance;
                            closestIndex = index;
                          }
                        });
                      }
                    }
                    
                    // Only show context menu if right-clicked very close to a point
                    if (closestPixelDistance < pixelThreshold && closestIndex >= 0 && closestIndex < embeddingPoints.length) {
                      const point = embeddingPoints[closestIndex];
                      setContextMenuPoint({ ...point, index: closestIndex });
                      setContextMenu({ x: e.clientX, y: e.clientY });
                    }
                  }}
                >
                  {isLoadingChart ? (
                    <div className="text-center">
                      <p className="text-[#A1A1AA]">Loading embeddings...</p>
                    </div>
                  ) : chartData && chartData.datasets && chartData.datasets.length > 0 ? (
                    <Chart ref={chartRef} type="scatter" data={chartData} options={chartOptions} />
                  ) : (
                    <div className="text-center">
                      <p className="text-[#A1A1AA]">
                        {!selectedSubreddit ? 'Select a subreddit to view embeddings' : 'No embedding data available for this metric'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Timeline Slider */}
                {timelineBounds && timelineBounds.dates.length > 1 && embeddingPoints.length > 0 && (
                  <div className="px-4 pb-4 pt-2 border-t border-[#1A1A23]">
                    <div className="flex items-center gap-3 mb-2">
                      <button
                        onClick={() => setTimelineEnabled(e => !e)}
                        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-[6px] border transition-all ${
                          timelineEnabled
                            ? 'border-[#FF3B3B] text-[#FF3B3B] bg-[#FF3B3B]/10'
                            : 'border-[#2A2A33] text-[#A1A1AA] hover:border-[#3A3A43]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${timelineEnabled ? 'bg-[#FF3B3B]' : 'bg-[#3A3A43]'}`} />
                        Timeline
                      </button>
                      {timelineEnabled && (() => {
                        const dateIdx = Math.round((timelinePos / 100) * (timelineBounds.dates.length - 1));
                        const activeDate = timelineBounds.dates[dateIdx];
                        const postsOnDay = embeddingPoints.filter((p: any) =>
                          p.created && new Date(p.created).toISOString().slice(0, 10) === activeDate
                        ).length;
                        return (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[#E6E6EB] font-medium">{new Date(activeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            <span className="text-[#6A6A73]">·</span>
                            <span className="text-[#6A6A73]">{postsOnDay} post{postsOnDay !== 1 ? 's' : ''}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="relative h-8 flex items-center gap-2">
                      <span className="text-[10px] text-[#6A6A73] whitespace-nowrap">{new Date(timelineBounds.dates[0]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                      <div className="relative flex-1 h-8 flex items-center">
                        <div className="absolute w-full h-1 rounded-full bg-[#2A2A33]" />
                        <div
                          className={`absolute w-0.5 h-3 rounded-full transition-colors ${timelineEnabled ? 'bg-[#FF3B3B]' : 'bg-[#3A3A43]'}`}
                          style={{ left: `calc(${timelinePos}% - 1px)` }}
                        />
                        <input
                          type="range"
                          min={0} max={100} step={1}
                          value={timelinePos}
                          onChange={(e) => { setTimelineEnabled(true); setTimelinePos(Number(e.target.value)); }}
                          className="absolute w-full h-1 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#FF3B3B] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#0B0B0F] [&::-webkit-slider-thumb]:shadow-md"
                        />
                      </div>
                      <span className="text-[10px] text-[#6A6A73] whitespace-nowrap">{new Date(timelineBounds.dates[timelineBounds.dates.length - 1]).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Post Details Modal */}
      {showPostModal && selectedPost && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0B0F] rounded-[12px] max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-2xl mx-4">
            {/* Close Button */}
            <div className="sticky top-0 flex justify-end p-4 bg-[#0B0B0F]/80 backdrop-blur-sm z-10">
              <button
                onClick={() => setShowPostModal(false)}
                className="text-[#A1A1AA] hover:text-[#E6E6EB] transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 pb-6">
              {isLoadingPostDetails ? (
                <div className="text-center py-12">
                  <p className="text-[#A1A1AA]">Loading...</p>
                </div>
              ) : (
                <>
                  {/* Title */}
                  <h2 className="text-2xl font-bold text-[#E6E6EB] mb-6 leading-tight">{selectedPost.title}</h2>

                  {/* Author & Subreddit */}
                  <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[#2A2A33]">
                    {selectedPost.author && (
                      <>
                        <span className="text-sm text-[#A1A1AA]">by {selectedPost.author}</span>
                        {selectedSubreddit && <span className="text-[#6A6A73]">•</span>}
                      </>
                    )}
                    {selectedSubreddit && (
                      <span className="text-sm text-[#A1A1AA]">r/{selectedSubreddit}</span>
                    )}
                  </div>

                  {/* Tags */}
                  {selectedPost.speech_type && selectedPost.speech_type.length > 0 && (
                    <div className="mb-6">
                      <div className="flex flex-wrap gap-2">
                        {selectedPost.speech_type.map((tag: string, idx: number) => {
                          const tagColors: Record<string, string> = {
                            pain: 'bg-[#FF9800]/15 text-[#FF9800]',
                            advice: 'bg-[#4CAF50]/15 text-[#4CAF50]',
                            narrative: 'bg-[#2196F3]/15 text-[#2196F3]',
                          };
                          return (
                            <span key={idx} className={`px-3 py-1 rounded-full text-xs font-medium ${tagColors[tag] || 'bg-[#2A2A33] text-[#A1A1AA]'}`}>
                              {tag.charAt(0).toUpperCase() + tag.slice(1)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-[#2A2A33]">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#FF3B3B]">{selectedPost.ups || 0}</p>
                      <p className="text-xs text-[#A1A1AA] mt-1 uppercase tracking-wide">Upvotes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#FF3B3B]">{selectedPost.comments || 0}</p>
                      <p className="text-xs text-[#A1A1AA] mt-1 uppercase tracking-wide">Comments</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-[#FF3B3B]">{selectedPost.upvote_ratio ? `${(selectedPost.upvote_ratio * 100).toFixed(0)}%` : 'N/A'}</p>
                      <p className="text-xs text-[#A1A1AA] mt-1 uppercase tracking-wide">Ratio</p>
                    </div>
                  </div>

                  {/* AI Summary */}
                  {selectedPost.ai_summary && (
                    <div className="mb-6">
                      <p className="text-xs text-[#A1A1AA] uppercase tracking-wide font-medium mb-3">Summary</p>
                      <p className="text-sm text-[#E6E6EB] leading-relaxed">{selectedPost.ai_summary}</p>
                    </div>
                  )}

                  {/* Entities */}
                  {selectedPost.entities && Array.isArray(selectedPost.entities) && selectedPost.entities.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs text-[#A1A1AA] uppercase tracking-wide font-medium mb-3">Entities</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPost.entities.map((entity: any, idx: number) => (
                          <span
                            key={idx}
                            className="bg-[#6B3BA0]/20 text-[#D4B5FF] text-xs px-2 py-1 rounded-md border border-[#6B3BA0]/40"
                          >
                            {typeof entity === 'string' ? entity : Object.values(entity as any).flat().join(', ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Links */}
                  {selectedPost.links && Array.isArray(selectedPost.links) && selectedPost.links.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs text-[#A1A1AA] uppercase tracking-wide font-medium mb-3">Outbound Links</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPost.links.map((link: any, idx: number) => (
                          <span
                            key={idx}
                            className="bg-[#1E5A96]/20 text-[#5FB3FF] text-xs px-2 py-1 rounded-md border border-[#1E5A96]/40"
                            title={link.context || link}
                          >
                            🔗 {link.platform ? <strong>{link.platform}</strong> : null}{link.platform && link.context ? ' — ' : ''}{link.context || link}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reddit Link */}
                  {selectedPost.post_id && selectedSubreddit && (
                    <a
                      href={`https://reddit.com/r/${selectedSubreddit}/comments/${selectedPost.post_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#FF3B3B] text-white text-sm font-semibold rounded-[8px] hover:bg-[#E32B2B] transition-all"
                    >
                      View on Reddit
                      <span>↗</span>
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group Details Modal */}
      {showGroupModal && selectedGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0B0F] rounded-[12px] max-w-xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col mx-4">
            {/* Header with Close */}
            <div className="sticky top-0 flex items-center justify-between p-4 bg-[#0B0B0F]/80 backdrop-blur-sm z-10 border-b border-[#2A2A33]">
              <div>
                {(() => {
                  const displayName = manualClusterNames[selectedGroup] || clusterNames[selectedGroup] || `Cluster ${selectedGroup.replace('cluster_', '')}`;
                  return <h2 className="text-lg font-bold text-[#E6E6EB] capitalize">{displayName}</h2>;
                })()}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRemoveGroup(selectedGroup)}
                  className="p-2 text-[#FF6B6B] hover:bg-[#FF3B3B]/10 rounded transition-colors"
                  title="Delete entire group"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => setShowGroupModal(false)}
                  className="p-2 text-[#A1A1AA] hover:text-[#E6E6EB] transition-colors"
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-0 border-b border-[#2A2A33] px-4 bg-[#0B0B0F]">
              <button
                onClick={() => setGroupModalTab('overview')}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  groupModalTab === 'overview'
                    ? 'text-[#E6E6EB] border-[#FF3B3B]'
                    : 'text-[#A1A1AA] border-transparent hover:text-[#E6E6EB]'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setGroupModalTab('posts')}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  groupModalTab === 'posts'
                    ? 'text-[#E6E6EB] border-[#FF3B3B]'
                    : 'text-[#A1A1AA] border-transparent hover:text-[#E6E6EB]'
                }`}
              >
                Posts
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {(() => {
                const groupedPosts = getGroupedPosts();
                const posts = groupedPosts[selectedGroup] || [];
                const displayName = manualClusterNames[selectedGroup] || clusterNames[selectedGroup] || `Cluster ${selectedGroup.replace('cluster_', '')}`;
                const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
                const totalUps = posts.reduce((sum, p) => sum + (p.ups || 0), 0);

                return (
                  <>
                    {groupModalTab === 'overview' ? (
                      <>
                        {/* Group Header */}
                        <div className="mb-6">
                          <div className="flex items-center gap-3">
                            {selectedGroup !== 'unassigned' && (
                              <div
                                className="w-5 h-5 rounded-full"
                                style={{
                                  backgroundColor: getColorForCluster(
                                    parseInt(selectedGroup.replace('cluster_', ''))
                                  ),
                                }}
                              ></div>
                            )}
                            <h3 className="text-xl font-semibold text-[#E6E6EB] capitalize">{displayName}</h3>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-[#2A2A33]">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-[#FF3B3B]">{posts.length}</p>
                            <p className="text-xs text-[#A1A1AA] mt-1 uppercase tracking-wide">Posts</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-[#FF3B3B]">{totalUps}</p>
                            <p className="text-xs text-[#A1A1AA] mt-1 uppercase tracking-wide">Upvotes</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-[#FF3B3B]">{totalComments}</p>
                            <p className="text-xs text-[#A1A1AA] mt-1 uppercase tracking-wide">Comments</p>
                          </div>
                        </div>

                        {/* Group Overview */}
                        <div className="mb-6 pb-6 border-b border-[#2A2A33]">
                          <p className="text-xs text-[#A1A1AA] uppercase tracking-wide font-medium mb-3">Overview</p>
                          {groupOverviews[selectedGroup] ? (
                            <p className="text-sm text-[#E6E6EB] leading-relaxed">{groupOverviews[selectedGroup]}</p>
                          ) : (
                            <p className="text-sm text-[#6A6A73]">Click the ✨ icon in the Groups section to generate overviews for all groups</p>
                          )}
                        </div>

                        {/* Top Posts Preview */}
                        <div>
                          <p className="text-xs text-[#A1A1AA] uppercase tracking-wide font-medium mb-3">Top Posts Preview</p>
                          <div className="space-y-2">
                            {posts.slice(0, 5).map((post, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  handlePostSelect(embeddingPoints.findIndex(p => p.post_id === post.post_id));
                                  setShowGroupModal(false);
                                }}
                                className="bg-[#18181F] border border-[#2A2A33] rounded-[8px] p-3 cursor-pointer hover:border-[#FF3B3B]/50 transition-all"
                              >
                                <p className="text-xs font-medium text-[#E6E6EB] mb-1 line-clamp-2 hover:text-[#FF3B3B]">{post.title}</p>
                                <div className="flex items-center gap-4 text-xs text-[#A1A1AA]">
                                  <span>👍 {post.ups || 0}</span>
                                  <span>💬 {post.comments || 0}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* All Posts List */}
                        <div className="space-y-2">
                          {posts.length === 0 ? (
                            <p className="text-center text-[#A1A1AA] py-8">No posts in this group</p>
                          ) : (
                            posts.map((post, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  handlePostSelect(embeddingPoints.findIndex(p => p.post_id === post.post_id));
                                  setShowGroupModal(false);
                                }}
                                className="bg-[#18181F] border border-[#2A2A33] rounded-[8px] p-3 cursor-pointer hover:border-[#FF3B3B]/50 transition-all"
                              >
                                <p className="text-xs font-medium text-[#E6E6EB] mb-1 line-clamp-2 hover:text-[#FF3B3B]">{post.title}</p>
                                <div className="flex items-center gap-4 text-xs text-[#A1A1AA]">
                                  <span>👍 {post.ups || 0}</span>
                                  <span>💬 {post.comments || 0}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && contextMenuPoint && (
        <div
          className="fixed bg-[#18181F] border border-[#2A2A33] rounded-[8px] shadow-xl z-[100] min-w-[160px]"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            onClick={() => {
              handlePostSelect(contextMenuPoint.index);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-[#E6E6EB] hover:bg-[#2A2A33] transition-colors flex items-center gap-2 border-b border-[#2A2A33]/50"
          >
            <Info size={16} />
            Detail
          </button>
          <button
            onClick={() => {
              handleRemovePoint(contextMenuPoint.index);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-[#FF6B6B] hover:bg-[#FF3B3B]/10 transition-colors flex items-center gap-2"
          >
            <Trash2 size={16} />
            Remove
          </button>
        </div>
      )}

      {/* Close context menu on outside click */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-[99]"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        />
      )}
    </main>
  );
}
