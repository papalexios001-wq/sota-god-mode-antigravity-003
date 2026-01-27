/**
 * ============================================================================
 * SOTA GOD MODE SECTION - ENTERPRISE GRADE
 * ============================================================================
 * 
 * This component provides the complete God Mode interface including:
 * - Priority URL Queue for manual URL targeting
 * - Exclusion controls for URLs and categories
 * - Real-time system logs
 * - Optimization history tracking
 * 
 * @version 2.0.0
 * @author SOTA Team
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GodModeURLInput, PriorityURL } from './GodModeURLInput';
import { XIcon } from './components';

interface OptimizedLog {
    title: string;
    url: string;
    timestamp: string;
}

interface GodModeSectionProps {
    isGodMode: boolean;
    setIsGodMode: (value: boolean) => void;
    godModeLogs: string[];
    optimizedHistory: OptimizedLog[];
    existingPages: any[];
    sitemapUrl: string;
    onAnalyzeGaps: () => void;
    isAnalyzingGaps: boolean;
    wpConfig: { url: string; username: string };
    wpPassword: string;
    onPriorityQueueUpdate?: (urls: PriorityURL[]) => void;
}

// Storage keys
const STORAGE_KEYS = {
    PRIORITY_URLS: 'sota_god_mode_priority_urls',
    EXCLUDED_URLS: 'sota_god_mode_excluded_urls',
    EXCLUDED_CATEGORIES: 'sota_god_mode_excluded_categories',
    PRIORITY_ONLY_MODE: 'sota_god_mode_priority_only'
} as const;

export const GodModeSection: React.FC<GodModeSectionProps> = ({
    isGodMode,
    setIsGodMode,
    godModeLogs,
    optimizedHistory,
    existingPages,
    sitemapUrl,
    onAnalyzeGaps,
    isAnalyzingGaps,
    wpConfig,
    wpPassword,
    onPriorityQueueUpdate
}) => {
    // Priority URL Queue State
    const [priorityUrls, setPriorityUrls] = useState<PriorityURL[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.PRIORITY_URLS);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Exclusion Controls State
    const [excludedUrls, setExcludedUrls] = useState<string>(() => {
        return localStorage.getItem(STORAGE_KEYS.EXCLUDED_URLS) || '';
    });

    const [excludedCategories, setExcludedCategories] = useState<string>(() => {
        return localStorage.getItem(STORAGE_KEYS.EXCLUDED_CATEGORIES) || '';
    });

    // Debug Mode State
    const [isDebugMode, setIsDebugMode] = useState(false);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);

    // Priority Only Mode - Only optimize specific URLs
    const [priorityOnlyMode, setPriorityOnlyMode] = useState<boolean>(() => {
        return localStorage.getItem(STORAGE_KEYS.PRIORITY_ONLY_MODE) === 'true';
    });

    // Persist priority URLs
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.PRIORITY_URLS, JSON.stringify(priorityUrls));
        if (onPriorityQueueUpdate) {
            onPriorityQueueUpdate(priorityUrls);
        }
    }, [priorityUrls, onPriorityQueueUpdate]);

    // Persist exclusions
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.EXCLUDED_URLS, excludedUrls);
    }, [excludedUrls]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.EXCLUDED_CATEGORIES, excludedCategories);
    }, [excludedCategories]);

    // Persistence for Priority Only Mode
    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.PRIORITY_ONLY_MODE, String(priorityOnlyMode));
    }, [priorityOnlyMode]);

    // Handle priority URL queue updates
    const handlePriorityUrlsChange = useCallback((urls: PriorityURL[]) => {
        setPriorityUrls(urls);
    }, []);

    // Debug WordPress API
    const handleDebugWordPressAPI = async () => {
        if (!wpConfig.url) {
            setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ❌ ERROR: WordPress URL not configured`, ...prev]);
            return;
        }

        setIsDebugMode(true);
        setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] 🔍 Starting WordPress API diagnostics...`, ...prev]);

        try {
            // Test 1: Check REST API availability
            const restResponse = await fetch(`${wpConfig.url.replace(/\/+$/, '')}/wp-json/`, { method: 'GET' });
            if (restResponse.ok) {
                setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ✅ REST API: Available`, ...prev]);
            } else {
                setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ⚠️ REST API: Status ${restResponse.status}`, ...prev]);
            }

            // Test 2: Check posts endpoint
            const postsResponse = await fetch(`${wpConfig.url.replace(/\/+$/, '')}/wp-json/wp/v2/posts?per_page=1`, { method: 'GET' });
            if (postsResponse.ok) {
                setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ✅ Posts Endpoint: Accessible`, ...prev]);
            } else {
                setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ⚠️ Posts Endpoint: Status ${postsResponse.status}`, ...prev]);
            }

            // Test 3: Check authentication
            if (wpConfig.username && wpPassword) {
                const authHeader = 'Basic ' + btoa(`${wpConfig.username}:${wpPassword}`);
                const authResponse = await fetch(`${wpConfig.url.replace(/\/+$/, '')}/wp-json/wp/v2/users/me`, {
                    method: 'GET',
                    headers: { 'Authorization': authHeader }
                });
                if (authResponse.ok) {
                    const userData = await authResponse.json();
                    setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ✅ Authentication: Valid (User: ${userData.name})`, ...prev]);
                } else {
                    setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ❌ Authentication: Failed (Status ${authResponse.status})`, ...prev]);
                }
            } else {
                setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ⚠️ Authentication: Credentials not configured`, ...prev]);
            }

            setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ✅ Diagnostics complete`, ...prev]);
        } catch (error: any) {
            setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ❌ Error: ${error.message}`, ...prev]);
        } finally {
            setIsDebugMode(false);
        }
    };

    // Get pending priority URLs count
    const pendingPriorityCount = priorityUrls.filter(u => u.status === 'pending').length;
    const processingPriorityCount = priorityUrls.filter(u => u.status === 'processing').length;

    return (
        <div className="tab-panel">
            <h3 style={{
                background: 'linear-gradient(to right, #3b82f6, #8b5cf6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '1.8rem',
                marginBottom: '0.5rem'
            }}>
                Blue Ocean Gap Analysis
            </h3>

            {/* Main God Mode Control Panel */}
            <div className="god-mode-panel" style={{
                background: isGodMode
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 78, 59, 0.3))'
                    : 'rgba(255,255,255,0.02)',
                border: isGodMode ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '2rem',
                transition: 'all 0.3s ease'
            }}>
                {/* Header with Toggle */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem'
                }}>
                    <div>
                        <h3 style={{
                            margin: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            color: isGodMode ? '#10B981' : 'white'
                        }}>
                            {isGodMode ? '⚡ GOD MODE ACTIVE' : '💤 God Mode (Autonomous Maintenance)'}
                            {pendingPriorityCount > 0 && (
                                <span style={{
                                    background: '#3B82F6',
                                    color: 'white',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold'
                                }}>
                                    {pendingPriorityCount} Priority
                                </span>
                            )}
                        </h3>
                        <p style={{
                            fontSize: '0.85rem',
                            color: '#94A3B8',
                            margin: '0.5rem 0 0 0'
                        }}>
                            Automatically scans your sitemap, prioritizes critical pages, and performs surgical SEO/Fact updates forever.
                        </p>
                    </div>
                    <label className="switch" style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '60px',
                        height: '34px'
                    }}>
                        <input
                            type="checkbox"
                            checked={isGodMode}
                            onChange={e => setIsGodMode(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span className="slider round" style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: isGodMode ? '#10B981' : '#334155',
                            transition: '.4s',
                            borderRadius: '34px'
                        }}>
                            <span style={{
                                position: 'absolute',
                                content: "",
                                height: '26px',
                                width: '26px',
                                left: '4px',
                                bottom: '4px',
                                backgroundColor: 'white',
                                transition: '.4s',
                                borderRadius: '50%',
                                transform: isGodMode ? 'translateX(26px)' : 'translateX(0)'
                            }}></span>
                        </span>
                    </label>
                </div>

                {/* Priority Mode Toggle */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    padding: '0.75rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    borderRadius: '8px'
                }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🎯 Priority Only Mode
                            {priorityOnlyMode && <span style={{ fontSize: '0.7rem', background: '#3B82F6', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>ACTIVE</span>}
                        </div>
                        <div style={{ color: '#94A3B8', fontSize: '0.8rem' }}>
                            Restricts God Mode to ONLY optimize URLs in your Priority Queue. Ignores sitemap scan.
                        </div>
                    </div>
                    <label className="switch" style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '48px',
                        height: '28px'
                    }}>
                        <input
                            type="checkbox"
                            checked={priorityOnlyMode}
                            onChange={e => setPriorityOnlyMode(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span className="slider round" style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: priorityOnlyMode ? '#3B82F6' : '#334155',
                            transition: '.4s',
                            borderRadius: '34px'
                        }}>
                            <span style={{
                                position: 'absolute',
                                content: "",
                                height: '20px',
                                width: '20px',
                                left: '4px',
                                bottom: '4px',
                                backgroundColor: 'white',
                                transition: '.4s',
                                borderRadius: '50%',
                                transform: priorityOnlyMode ? 'translateX(20px)' : 'translateX(0)'
                            }}></span>
                        </span>
                    </label>
                </div>

                {/* Priority URL Queue - Always Visible */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <GodModeURLInput
                        priorityUrls={priorityUrls}
                        onPriorityUrlsChange={handlePriorityUrlsChange}
                        isGodModeActive={isGodMode}
                        maxUrls={100}
                    />
                </div>

                {/* Debug and Exclusion Controls */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    marginBottom: '1.5rem'
                }}>
                    {/* Debug WordPress API */}
                    <div style={{
                        background: '#0F172A',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid #1E293B'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.75rem'
                        }}>
                            <span style={{ color: '#94A3B8', fontSize: '0.85rem', fontWeight: 600 }}>
                                🔍 Debug WordPress API
                            </span>
                            <button
                                onClick={handleDebugWordPressAPI}
                                disabled={isDebugMode}
                                style={{
                                    background: '#3B82F6',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    cursor: isDebugMode ? 'wait' : 'pointer',
                                    opacity: isDebugMode ? 0.7 : 1
                                }}
                            >
                                {isDebugMode ? 'Testing...' : 'Run Diagnostics'}
                            </button>
                        </div>
                        {debugLogs.length > 0 && (
                            <div style={{
                                background: '#020617',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                maxHeight: '100px',
                                overflowY: 'auto',
                                fontFamily: 'monospace',
                                fontSize: '0.7rem'
                            }}>
                                {debugLogs.slice(0, 10).map((log, i) => (
                                    <div key={i} style={{
                                        color: log.includes('✅') ? '#10B981'
                                            : log.includes('❌') ? '#EF4444'
                                                : log.includes('⚠️') ? '#F59E0B'
                                                    : '#94A3B8',
                                        marginBottom: '2px'
                                    }}>
                                        {log}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Exclusion Controls */}
                    <div style={{
                        background: '#0F172A',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid #1E293B'
                    }}>
                        <span style={{
                            color: '#94A3B8',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            display: 'block',
                            marginBottom: '0.75rem'
                        }}>
                            🚫 Exclusion Controls
                        </span>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ color: '#64748B', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>
                                Exclude URLs (one per line)
                            </label>
                            <textarea
                                value={excludedUrls}
                                onChange={e => setExcludedUrls(e.target.value)}
                                placeholder="https://example.com/page-to-skip&#10;https://example.com/another-page"
                                style={{
                                    width: '100%',
                                    height: '50px',
                                    background: '#020617',
                                    border: '1px solid #1E293B',
                                    borderRadius: '4px',
                                    color: '#E2E8F0',
                                    padding: '0.5rem',
                                    fontSize: '0.7rem',
                                    fontFamily: 'monospace',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ color: '#64748B', fontSize: '0.7rem', display: 'block', marginBottom: '4px' }}>
                                Exclude Categories (one per line)
                            </label>
                            <textarea
                                value={excludedCategories}
                                onChange={e => setExcludedCategories(e.target.value)}
                                placeholder="uncategorized&#10;drafts"
                                style={{
                                    width: '100%',
                                    height: '40px',
                                    background: '#020617',
                                    border: '1px solid #1E293B',
                                    borderRadius: '4px',
                                    color: '#E2E8F0',
                                    padding: '0.5rem',
                                    fontSize: '0.7rem',
                                    fontFamily: 'monospace',
                                    resize: 'vertical'
                                }}
                            />
                        </div>
                        <p style={{
                            color: '#64748B',
                            fontSize: '0.65rem',
                            margin: '0.5rem 0 0 0',
                            fontStyle: 'italic'
                        }}>
                            ℹ️ GOD MODE will skip optimizing these URLs and categories. Changes take effect immediately.
                        </p>
                    </div>
                </div>

                {/* Active God Mode Dashboard */}
                {isGodMode && (
                    <div className="god-mode-dashboard" style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.5fr',
                        gap: '1rem'
                    }}>
                        {/* System Logs - SOTA ENTERPRISE GRADE */}
                        <div className="god-mode-logs" style={{
                            background: 'linear-gradient(135deg, #020617 0%, #0F172A 100%)',
                            padding: '1.25rem',
                            borderRadius: '12px',
                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                            fontSize: '0.75rem',
                            height: '240px',
                            overflowY: 'auto',
                            border: '1px solid #1e293b',
                            boxShadow: 'inset 0 4px 8px 0 rgba(0,0,0,0.6)'
                        }}>
                            <div style={{
                                color: '#10B981',
                                borderBottom: '1px solid #1e293b',
                                paddingBottom: '0.75rem',
                                marginBottom: '0.75rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontWeight: 700, letterSpacing: '0.05em' }}>📋 SYSTEM LOGS</span>
                                <span style={{
                                    fontSize: '0.65rem',
                                    color: '#64748B',
                                    background: 'rgba(100,116,139,0.2)',
                                    padding: '2px 8px',
                                    borderRadius: '4px'
                                }}>
                                    {godModeLogs.length} entries
                                </span>
                            </div>
                            {godModeLogs.length === 0 ? (
                                <div style={{
                                    color: '#64748B',
                                    textAlign: 'center',
                                    padding: '2rem',
                                    fontStyle: 'italic'
                                }}>
                                    ⏳ Waiting for optimization tasks...
                                </div>
                            ) : (
                                godModeLogs.map((log, i) => {
                                    // Parse log type for styling
                                    const isError = log.includes('❌') || log.includes('FAILED') || log.includes('Error');
                                    const isSuccess = log.includes('✅') || log.includes('SUCCESS');
                                    const isWarning = log.includes('⚠️') || log.includes('WARNING');
                                    const isInfo = log.includes('📊') || log.includes('🎯') || log.includes('📥');
                                    const isAction = log.includes('🚀') || log.includes('⚡') || log.includes('🔗');

                                    // Parse success logs for title and URL
                                    let formattedLog = log;
                                    let logUrl = '';
                                    if (log.includes('SUCCESS|')) {
                                        const parts = log.split('|');
                                        if (parts.length >= 3) {
                                            formattedLog = `✅ OPTIMIZED: ${parts[1]}`;
                                            logUrl = parts[2];
                                        }
                                    }

                                    return (
                                        <div key={i} style={{
                                            marginBottom: '8px',
                                            padding: '8px 10px',
                                            background: isError ? 'rgba(239,68,68,0.08)'
                                                : isSuccess ? 'rgba(16,185,129,0.08)'
                                                    : isWarning ? 'rgba(245,158,11,0.08)'
                                                        : 'transparent',
                                            borderRadius: '6px',
                                            borderLeft: `3px solid ${isError ? '#EF4444'
                                                : isSuccess ? '#10B981'
                                                    : isWarning ? '#F59E0B'
                                                        : isAction ? '#8B5CF6'
                                                            : isInfo ? '#3B82F6'
                                                                : '#334155'
                                                }`,
                                            color: isError ? '#FCA5A5'
                                                : isSuccess ? '#6EE7B7'
                                                    : isWarning ? '#FCD34D'
                                                        : '#94A3B8',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '4px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{
                                                    opacity: 0.5,
                                                    fontSize: '0.65rem',
                                                    color: '#64748B'
                                                }}>
                                                    [{new Date().toLocaleTimeString()}]
                                                </span>
                                                <span style={{ flex: 1 }}>{formattedLog}</span>
                                            </div>
                                            {logUrl && (
                                                <a
                                                    href={logUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{
                                                        color: '#3B82F6',
                                                        fontSize: '0.65rem',
                                                        textDecoration: 'none',
                                                        opacity: 0.8
                                                    }}
                                                >
                                                    🔗 {logUrl}
                                                </a>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Recently Optimized */}
                        <div className="optimized-list" style={{
                            background: '#020617',
                            padding: '1rem',
                            borderRadius: '8px',
                            height: '200px',
                            overflowY: 'auto',
                            border: '1px solid #1e293b'
                        }}>
                            <div style={{
                                color: '#10B981',
                                borderBottom: '1px solid #1e293b',
                                paddingBottom: '0.5rem',
                                marginBottom: '0.5rem',
                                fontWeight: 'bold'
                            }}>
                                ✅ RECENTLY OPTIMIZED ({optimizedHistory.length})
                            </div>
                            {optimizedHistory.length === 0 ? (
                                <div style={{
                                    color: '#64748B',
                                    fontSize: '0.85rem',
                                    fontStyle: 'italic',
                                    padding: '1rem',
                                    textAlign: 'center'
                                }}>
                                    No posts optimized in this session yet. Waiting for targets...
                                </div>
                            ) : (
                                optimizedHistory.map((item, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.5rem',
                                        borderBottom: '1px solid #1e293b'
                                    }}>
                                        <div style={{
                                            overflow: 'hidden',
                                            whiteSpace: 'nowrap',
                                            textOverflow: 'ellipsis',
                                            marginRight: '1rem'
                                        }}>
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    color: '#E2E8F0',
                                                    textDecoration: 'none',
                                                    fontWeight: 500,
                                                    fontSize: '0.9rem'
                                                }}
                                            >
                                                {item.title}
                                            </a>
                                        </div>
                                        <div style={{
                                            color: '#64748B',
                                            fontSize: '0.75rem',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {item.timestamp}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Gap Analysis Action */}
            {existingPages.length === 0 && !sitemapUrl ? (
                <div className="sitemap-warning" style={{
                    padding: '1.5rem',
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid var(--error)',
                    borderRadius: '12px',
                    color: '#FCA5A5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <XIcon />
                    <div>
                        <strong>Sitemap Required:</strong> Please crawl your sitemap in the "Quick Refresh" tab first.
                        The AI needs to know your existing content to find the gaps.
                    </div>
                </div>
            ) : (
                <button
                    className="btn"
                    onClick={onAnalyzeGaps}
                    disabled={isAnalyzingGaps}
                    style={{
                        width: '100%',
                        padding: '1rem',
                        fontSize: '1rem'
                    }}
                >
                    {isAnalyzingGaps ? 'Scanning...' : '🚀 Run Deep Gap Analysis'}
                </button>
            )}
        </div>
    );
};

export default GodModeSection;

// Export utility function to get exclusion lists
export const getExclusionLists = () => {
    const excludedUrls = localStorage.getItem(STORAGE_KEYS.EXCLUDED_URLS) || '';
    const excludedCategories = localStorage.getItem(STORAGE_KEYS.EXCLUDED_CATEGORIES) || '';

    return {
        urls: excludedUrls.split('\n').map(u => u.trim()).filter(Boolean),
        categories: excludedCategories.split('\n').map(c => c.trim().toLowerCase()).filter(Boolean)
    };
};

// Export utility function to get priority URLs
export const getPriorityUrls = (): PriorityURL[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.PRIORITY_URLS);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
};

// Export utility function to update priority URL status
export const updatePriorityUrlStatus = (
    url: string,
    status: PriorityURL['status'],
    optimizedAt?: string
) => {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.PRIORITY_URLS);
        const urls: PriorityURL[] = saved ? JSON.parse(saved) : [];
        const updatedUrls = urls.map(u =>
            u.url === url
                ? { ...u, status, optimizedAt: optimizedAt || u.optimizedAt }
                : u
        );
        localStorage.setItem(STORAGE_KEYS.PRIORITY_URLS, JSON.stringify(updatedUrls));
        return updatedUrls;
    } catch {
        return [];
    }
};
