import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// ==================== TYPES ====================
interface ClusterPage {
  id: string;
  title: string;
  url: string;
  slug: string;
  wordCount?: number;
  lastUpdated?: string;
  internalLinks: string[];
  externalLinks: string[];
  linkedFrom: string[];
  status: 'published' | 'draft' | 'planned';
  coverageScore: number;
}

interface TopicCluster {
  id: string;
  name: string;
  pillarPage: ClusterPage | null;
  clusterPages: ClusterPage[];
  targetKeywords: string[];
  topicalAuthorityScore: number;
  contentGaps: ContentGap[];
  recommendations: ClusterRecommendation[];
}

interface ContentGap {
  topic: string;
  searchVolume: number;
  difficulty: number;
  priority: 'high' | 'medium' | 'low';
  suggestedTitle: string;
  relatedCluster: string;
}

interface ClusterRecommendation {
  type: 'create' | 'update' | 'merge' | 'link';
  title: string;
  description: string;
  priority: number;
  impact: string;
  action: () => void;
}

interface LinkConnection {
  source: string;
  target: string;
  strength: number;
  type: 'internal' | 'pillar-cluster' | 'cluster-cluster';
}

interface TopicAuthorityHubProps {
  existingPages: Array<{
    id: string;
    title: string;
    url: string;
    slug: string;
    content?: string;
  }>;
  onCreateContent?: (topic: string, cluster: string) => void;
  onUpdateContent?: (pageId: string) => void;
  aiClient?: any;
  model?: string;
}

// ==================== MAIN COMPONENT ====================
export const TopicAuthorityHub: React.FC<TopicAuthorityHubProps> = ({
  existingPages,
  onCreateContent,
  onUpdateContent,
  aiClient,
  model
}) => {
  // State
  const [clusters, setClusters] = useState<TopicCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<TopicCluster | null>(null);
  const [contentGaps, setContentGaps] = useState<ContentGap[]>([]);
  const [linkConnections, setLinkConnections] = useState<LinkConnection[]>([]);
  const [viewMode, setViewMode] = useState<'mindmap' | 'heatmap' | 'linkflow' | 'recommendations'>('mindmap');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ==================== CLUSTER DETECTION ====================
  const detectTopicClusters = useCallback(async () => {
    setIsAnalyzing(true);
    
    // Analyze page titles and content to identify clusters
    const pageAnalysis: ClusterPage[] = existingPages.map(page => {
      // Extract keywords from title
      const titleWords = page.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);
      
      // Find internal links (simplified - in production, parse HTML content)
      const internalLinks: string[] = [];
      const linkedFrom: string[] = [];
      
      existingPages.forEach(other => {
        if (other.id !== page.id) {
          // Check if this page might link to other (based on keyword overlap)
          const otherWords = other.title.toLowerCase().split(/\s+/);
          const overlap = titleWords.filter(w => otherWords.includes(w)).length;
          if (overlap >= 2) {
            internalLinks.push(other.id);
          }
        }
      });
      
      return {
        id: page.id,
        title: page.title,
        url: page.url,
        slug: page.slug,
        internalLinks,
        externalLinks: [],
        linkedFrom,
        status: 'published' as const,
        coverageScore: Math.floor(Math.random() * 40) + 60 // Placeholder
      };
    });

    // Group pages into clusters based on keyword similarity
    const clusterMap = new Map<string, ClusterPage[]>();
    
    pageAnalysis.forEach(page => {
      const mainTopic = extractMainTopic(page.title);
      if (!clusterMap.has(mainTopic)) {
        clusterMap.set(mainTopic, []);
      }
      clusterMap.get(mainTopic)!.push(page);
    });

    // Convert to TopicCluster array
    const detectedClusters: TopicCluster[] = Array.from(clusterMap.entries())
      .filter(([_, pages]) => pages.length >= 2)
      .map(([topic, pages], idx) => {
        // Find pillar page (longest title or most links)
        const pillarPage = pages.reduce((best, current) => {
          const bestScore = best.internalLinks.length + best.linkedFrom.length;
          const currentScore = current.internalLinks.length + current.linkedFrom.length;
          return currentScore > bestScore ? current : best;
        }, pages[0]);

        const clusterPages = pages.filter(p => p.id !== pillarPage.id);

        return {
          id: `cluster-${idx}`,
          name: topic,
          pillarPage,
          clusterPages,
          targetKeywords: [topic, ...extractRelatedKeywords(topic)],
          topicalAuthorityScore: calculateAuthorityScore(pages),
          contentGaps: detectGapsForCluster(topic, pages),
          recommendations: generateRecommendations(topic, pages)
        };
      });

    setClusters(detectedClusters);
    
    // Generate link connections for visualization
    const connections: LinkConnection[] = [];
    detectedClusters.forEach(cluster => {
      if (cluster.pillarPage) {
        cluster.clusterPages.forEach(page => {
          connections.push({
            source: cluster.pillarPage!.id,
            target: page.id,
            strength: 0.8,
            type: 'pillar-cluster'
          });
        });
      }
    });
    setLinkConnections(connections);

    // Aggregate all content gaps
    const allGaps = detectedClusters.flatMap(c => c.contentGaps);
    setContentGaps(allGaps.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }));

    setIsAnalyzing(false);
  }, [existingPages]);

  // Run cluster detection on mount
  useEffect(() => {
    if (existingPages.length > 0) {
      detectTopicClusters();
    }
  }, [existingPages, detectTopicClusters]);

  // ==================== VISUALIZATION RENDERERS ====================
  
  // Mind Map Renderer
  const renderMindMap = () => {
    if (!selectedCluster) {
      return (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '20px',
          justifyContent: 'center',
          padding: '40px'
        }}>
          {clusters.map(cluster => (
            <div
              key={cluster.id}
              onClick={() => setSelectedCluster(cluster)}
              style={{
                width: '280px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                border: '2px solid transparent',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '2px solid #8B5CF6';
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '2px solid transparent';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Authority Score Badge */}
              <div style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: `conic-gradient(${getScoreColor(cluster.topicalAuthorityScore)} ${cluster.topicalAuthorityScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#1E1E2E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  color: getScoreColor(cluster.topicalAuthorityScore)
                }}>
                  {cluster.topicalAuthorityScore}
                </div>
              </div>

              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '1.1rem',
                fontWeight: '700',
                color: 'white',
                paddingRight: '60px'
              }}>
                📚 {cluster.name}
              </h3>

              <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8B5CF6' }}>
                    {cluster.clusterPages.length + (cluster.pillarPage ? 1 : 0)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                    Articles
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#EC4899' }}>
                    {cluster.contentGaps.length}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                    Gaps
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10B981' }}>
                    {cluster.targetKeywords.length}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                    Keywords
                  </div>
                </div>
              </div>

              {cluster.pillarPage && (
                <div style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ color: '#8B5CF6', fontWeight: '600', marginBottom: '4px' }}>
                    🎯 Pillar Page
                  </div>
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {cluster.pillarPage.title}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // Detailed cluster view
    return (
      <div style={{ padding: '24px' }}>
        <button
          onClick={() => setSelectedCluster(null)}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Back to All Clusters
        </button>

        <div style={{ display: 'flex', gap: '32px' }}>
          {/* Left: Visual Network */}
          <div style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '16px',
            padding: '24px',
            minHeight: '500px',
            position: 'relative'
          }}>
            <h3 style={{ color: 'white', margin: '0 0 24px 0' }}>
              🕸️ Content Network: {selectedCluster.name}
            </h3>
            
            {/* Network Visualization */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '400px'
            }}>
              {/* Pillar Page (Center) */}
              {selectedCluster.pillarPage && (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 40px rgba(139, 92, 246, 0.5)',
                  zIndex: 10
                }}>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: '#1E1E2E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    textAlign: 'center',
                    padding: '8px'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>🎯</span>
                    <span style={{
                      fontSize: '0.65rem',
                      color: 'white',
                      marginTop: '4px',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }}>
                      {selectedCluster.pillarPage.title.split(' ').slice(0, 4).join(' ')}
                    </span>
                  </div>
                </div>
              )}

              {/* Cluster Pages (Orbiting) */}
              {selectedCluster.clusterPages.map((page, idx) => {
                const total = selectedCluster.clusterPages.length;
                const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
                const radius = 160;
                const x = 50 + (radius / 4) * Math.cos(angle);
                const y = 50 + (radius / 4) * Math.sin(angle);
                
                return (
                  <React.Fragment key={page.id}>
                    {/* Connection Line */}
                    <svg
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none'
                      }}
                    >
                      <line
                        x1="50%"
                        y1="50%"
                        x2={`${x}%`}
                        y2={`${y}%`}
                        stroke="rgba(139, 92, 246, 0.3)"
                        strokeWidth="2"
                        strokeDasharray="5,5"
                      />
                    </svg>
                    
                    {/* Cluster Node */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(139, 92, 246, 0.2)',
                        border: '2px solid rgba(139, 92, 246, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      title={page.title}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.4)';
                        e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
                        e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                      }}
                    >
                      <span style={{
                        fontSize: '0.55rem',
                        color: 'white',
                        textAlign: 'center',
                        padding: '4px',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical'
                      }}>
                        {page.title.split(' ').slice(0, 4).join(' ')}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Right: Stats & Actions */}
          <div style={{ width: '350px' }}>
            {/* Authority Score */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px',
              textAlign: 'center'
            }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: `conic-gradient(${getScoreColor(selectedCluster.topicalAuthorityScore)} ${selectedCluster.topicalAuthorityScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#1E1E2E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column'
                }}>
                  <span style={{
                    fontSize: '1.8rem',
                    fontWeight: '800',
                    color: getScoreColor(selectedCluster.topicalAuthorityScore)
                  }}>
                    {selectedCluster.topicalAuthorityScore}
                  </span>
                </div>
              </div>
              <div style={{ color: 'white', fontWeight: '600' }}>Topical Authority Score</div>
            </div>

            {/* Content Gaps */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '16px'
            }}>
              <h4 style={{ color: '#EC4899', margin: '0 0 16px 0' }}>
                🕳️ Content Gaps ({selectedCluster.contentGaps.length})
              </h4>
              {selectedCluster.contentGaps.slice(0, 3).map((gap, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(236, 72, 153, 0.1)',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '8px'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{
                      color: 'white',
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}>
                      {gap.topic}
                    </span>
                    <span style={{
                      background: gap.priority === 'high' ? '#EF4444' : gap.priority === 'medium' ? '#F59E0B' : '#10B981',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.65rem',
                      fontWeight: '600'
                    }}>
                      {gap.priority.toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => onCreateContent?.(gap.suggestedTitle, selectedCluster.name)}
                    style={{
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                      border: 'none',
                      color: 'white',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      width: '100%'
                    }}
                  >
                    ✨ Create Article
                  </button>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              padding: '24px'
            }}>
              <h4 style={{ color: '#10B981', margin: '0 0 16px 0' }}>
                ⚡ Quick Actions
              </h4>
              <button
                style={{
                  width: '100%',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  color: '#10B981',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  fontWeight: '600'
                }}
              >
                🔗 Auto-Link Cluster Articles
              </button>
              <button
                style={{
                  width: '100%',
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.5)',
                  color: '#8B5CF6',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: '8px',
                  fontWeight: '600'
                }}
              >
                📊 Generate Cluster Report
              </button>
              <button
                style={{
                  width: '100%',
                  background: 'rgba(236, 72, 153, 0.2)',
                  border: '1px solid rgba(236, 72, 153, 0.5)',
                  color: '#EC4899',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                🎯 Optimize All Articles
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Heat Map Renderer
  const renderHeatMap = () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ color: 'white', marginBottom: '24px' }}>
        🗺️ Content Coverage Heat Map
      </h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '8px'
      }}>
        {clusters.flatMap(cluster => [
          // Pillar page
          cluster.pillarPage && (
            <div
              key={cluster.pillarPage.id}
              style={{
                background: getCoverageColor(cluster.pillarPage.coverageScore),
                borderRadius: '8px',
                padding: '16px',
                minHeight: '100px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{
                fontSize: '0.7rem',
                color: 'rgba(255, 255, 255, 0.7)',
                marginBottom: '8px'
              }}>
                {cluster.name}
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: 'white',
                fontWeight: '600',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {cluster.pillarPage.title}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.8)',
                marginTop: '8px'
              }}>
                Coverage: {cluster.pillarPage.coverageScore}%
              </div>
            </div>
          ),
          // Cluster pages
          ...cluster.clusterPages.map(page => (
            <div
              key={page.id}
              style={{
                background: getCoverageColor(page.coverageScore),
                borderRadius: '8px',
                padding: '12px',
                minHeight: '80px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{
                fontSize: '0.75rem',
                color: 'white',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}>
                {page.title}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: 'rgba(255, 255, 255, 0.8)',
                marginTop: '8px'
              }}>
                {page.coverageScore}%
              </div>
            </div>
          ))
        ])}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '24px',
        marginTop: '32px',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#EF4444' }} />
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>Thin Coverage (0-40%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#F59E0B' }} />
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>Moderate (40-70%)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: '#10B981' }} />
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>Strong (70-100%)</span>
        </div>
      </div>
    </div>
  );

  // Recommendations View
  const renderRecommendations = () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ color: 'white', marginBottom: '24px' }}>
        💡 AI-Powered Recommendations
      </h3>
      
      <div style={{ display: 'grid', gap: '16px' }}>
        {clusters.flatMap(cluster => cluster.recommendations).slice(0, 10).map((rec, idx) => (
          <div
            key={idx}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              border: '1px solid rgba(139, 92, 246, 0.2)'
            }}
          >
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              background: rec.type === 'create' ? 'rgba(16, 185, 129, 0.2)' :
                         rec.type === 'update' ? 'rgba(245, 158, 11, 0.2)' :
                         rec.type === 'link' ? 'rgba(139, 92, 246, 0.2)' :
                         'rgba(236, 72, 153, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              {rec.type === 'create' ? '✨' :
               rec.type === 'update' ? '🔄' :
               rec.type === 'link' ? '🔗' : '🔀'}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{
                  color: 'white',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}>
                  {rec.title}
                </span>
                <span style={{
                  background: `rgba(139, 92, 246, ${rec.priority / 10})`,
                  color: '#8B5CF6',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  Priority: {rec.priority}/10
                </span>
              </div>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                margin: '0 0 12px 0',
                fontSize: '0.9rem'
              }}>
                {rec.description}
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  color: '#10B981',
                  fontSize: '0.8rem'
                }}>
                  📈 Impact: {rec.impact}
                </span>
                <button
                  onClick={rec.action}
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                    border: 'none',
                    color: 'white',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.85rem'
                  }}
                >
                  Take Action →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1E1E2E 0%, #2D2D44 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
      border: '1px solid rgba(139, 92, 246, 0.3)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🗺️ Topic Authority Hub
        </h2>

        {/* View Mode Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'mindmap', label: '🕸️ Mind Map' },
            { id: 'heatmap', label: '🗺️ Heat Map' },
            { id: 'recommendations', label: '💡 Recommendations' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease',
                background: viewMode === tab.id
                  ? 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: viewMode === tab.id ? 'white' : 'rgba(255, 255, 255, 0.7)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#8B5CF6' }}>
            {clusters.length}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            Topic Clusters
          </div>
        </div>
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#10B981' }}>
            {existingPages.length}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            Total Articles
          </div>
        </div>
        <div style={{
          background: 'rgba(236, 72, 153, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#EC4899' }}>
            {contentGaps.length}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            Content Gaps
          </div>
        </div>
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', fontWeight: '800', color: '#3B82F6' }}>
            {clusters.length > 0 
              ? Math.round(clusters.reduce((sum, c) => sum + c.topicalAuthorityScore, 0) / clusters.length)
              : 0}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
            Avg. Authority
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        minHeight: '500px'
      }}>
        {isAnalyzing ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '400px',
            gap: '16px'
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '4px solid rgba(139, 92, 246, 0.3)',
              borderTopColor: '#8B5CF6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Analyzing topic clusters...
            </span>
          </div>
        ) : (
          <>
            {viewMode === 'mindmap' && renderMindMap()}
            {viewMode === 'heatmap' && renderHeatMap()}
            {viewMode === 'recommendations' && renderRecommendations()}
          </>
        )}
      </div>
    </div>
  );
};

// ==================== HELPER FUNCTIONS ====================

function extractMainTopic(title: string): string {
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'best', 'top', 'guide', 'how', 'what', 'why', 'when', 'where', 'which', 'who', 'complete', 'ultimate', 'vs', 'review', 'reviews'];
  
  const words = title.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !commonWords.includes(w));
  
  // Return first 2-3 significant words as topic
  return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Uncategorized';
}

function extractRelatedKeywords(topic: string): string[] {
  // In production, this would call an AI or use a keyword API
  const variations = [
    `${topic} guide`,
    `${topic} tips`,
    `best ${topic}`,
    `${topic} 2026`
  ];
  return variations;
}

function calculateAuthorityScore(pages: ClusterPage[]): number {
  if (pages.length === 0) return 0;
  
  const avgCoverage = pages.reduce((sum, p) => sum + p.coverageScore, 0) / pages.length;
  const linkBonus = Math.min(20, pages.length * 3);
  
  return Math.min(100, Math.round(avgCoverage * 0.8 + linkBonus));
}

function detectGapsForCluster(topic: string, pages: ClusterPage[]): ContentGap[] {
  // In production, this would use AI to analyze gaps
  const potentialGaps: ContentGap[] = [
    {
      topic: `${topic} for Beginners`,
      searchVolume: 1200,
      difficulty: 35,
      priority: 'high',
      suggestedTitle: `The Complete Beginner's Guide to ${topic}`,
      relatedCluster: topic
    },
    {
      topic: `${topic} vs Alternatives`,
      searchVolume: 800,
      difficulty: 45,
      priority: 'medium',
      suggestedTitle: `${topic} vs Top Alternatives: Which is Best in 2026?`,
      relatedCluster: topic
    }
  ];
  
  return potentialGaps;
}

function generateRecommendations(topic: string, pages: ClusterPage[]): ClusterRecommendation[] {
  const recommendations: ClusterRecommendation[] = [];
  
  if (pages.length < 5) {
    recommendations.push({
      type: 'create',
      title: `Expand ${topic} Cluster`,
      description: `Your ${topic} cluster only has ${pages.length} articles. Add 3-5 more supporting articles to establish topical authority.`,
      priority: 9,
      impact: '+35% topical authority',
      action: () => console.log('Create content action')
    });
  }
  
  const lowCoveragePages = pages.filter(p => p.coverageScore < 60);
  if (lowCoveragePages.length > 0) {
    recommendations.push({
      type: 'update',
      title: `Update Thin Content`,
      description: `${lowCoveragePages.length} articles in this cluster have low coverage scores. Update them to improve cluster authority.`,
      priority: 8,
      impact: '+25% content quality',
      action: () => console.log('Update content action')
    });
  }
  
  recommendations.push({
    type: 'link',
    title: `Strengthen Internal Links`,
    description: `Add more internal links between ${topic} articles to improve PageRank distribution and user navigation.`,
    priority: 7,
    impact: '+15% organic visibility',
    action: () => console.log('Link action')
  });
  
  return recommendations;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

function getCoverageColor(score: number): string {
  if (score >= 70) return 'rgba(16, 185, 129, 0.6)';
  if (score >= 40) return 'rgba(245, 158, 11, 0.6)';
  return 'rgba(239, 68, 68, 0.6)';
}

export default TopicAuthorityHub;

