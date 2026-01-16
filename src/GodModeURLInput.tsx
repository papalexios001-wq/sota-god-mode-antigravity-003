'use client';

import React, { useState, useCallback, memo, useEffect, useRef } from 'react';

// ============================================================================
// TYPES & INTERFACES - Enterprise Grade URL Queue Management
// ============================================================================

export interface PriorityURLItem {
  id: string;
  url: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  addedAt: number;
  processedAt?: number;
  errorMessage?: string;
  retryCount: number;
  metadata?: {
    title?: string;
    wordCount?: number;
    lastModified?: string;
  };
}

export interface GodModeURLInputProps {
  onURLsSubmitted: (urls: PriorityURLItem[]) => void;
  onStartProcessing: (urls: PriorityURLItem[]) => void;
  onClearQueue?: () => void;
  isGodModeActive: boolean;
  isProcessing: boolean;
  existingPages?: { id: string }[];
  excludedUrls?: string[];
  excludedCategories?: string[];
}

export interface QueueStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const generateUniqueId = (): string => 
  `purl-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const normalizeUrl = (url: string): string => {
  let normalized = url.trim();
  if (!normalized.startsWith('http')) {
    normalized = `https://${normalized}`;
  }
  // Remove trailing slash for consistency
  return normalized.replace(/\/+$/, '');
};

const getPriorityColor = (priority: PriorityURLItem['priority']): string => {
  const colors = {
    critical: '#EF4444',
    high: '#F59E0B',
    medium: '#3B82F6',
    low: '#6B7280'
  };
  return colors[priority];
};

const getStatusColor = (status: PriorityURLItem['status']): string => {
  const colors = {
    queued: '#94A3B8',
    processing: '#3B82F6',
    completed: '#10B981',
    failed: '#EF4444',
    skipped: '#F59E0B'
  };
  return colors[status];
};

const getStatusIcon = (status: PriorityURLItem['status']): string => {
  const icons = {
    queued: '⏳',
    processing: '🔄',
    completed: '✅',
    failed: '❌',
    skipped: '⏭️'
  };
  return icons[status];
};

// ============================================================================
// MAIN COMPONENT - God Mode Priority URL Queue
// ============================================================================

export const GodModeURLInput = memo(({
  onURLsSubmitted,
  onStartProcessing,
  onClearQueue,
  isGodModeActive,
  isProcessing,
  existingPages = [],
  excludedUrls = [],
  excludedCategories = [],
}: GodModeURLInputProps) => {
  // State Management
  const [inputMode, setInputMode] = useState<'single' | 'bulk' | 'import'>('single');
  const [singleURL, setSingleURL] = useState('');
  const [bulkURLs, setBulkURLs] = useState('');
  const [defaultPriority, setDefaultPriority] = useState<PriorityURLItem['priority']>('high');
  const [urlQueue, setUrlQueue] = useState<PriorityURLItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PriorityURLItem['status']>('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load saved queue from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('godmode_url_queue');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setUrlQueue(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load URL queue:', e);
    }
  }, []);

  // Save queue to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem('godmode_url_queue', JSON.stringify(urlQueue));
    } catch (e) {
      console.error('Failed to save URL queue:', e);
    }
  }, [urlQueue]);

  // Notify parent of queue changes
  useEffect(() => {
    onURLsSubmitted(urlQueue);
  }, [urlQueue, onURLsSubmitted]);

  // Calculate queue statistics
  const queueStats: QueueStats = {
    total: urlQueue.length,
    queued: urlQueue.filter(u => u.status === 'queued').length,
    processing: urlQueue.filter(u => u.status === 'processing').length,
    completed: urlQueue.filter(u => u.status === 'completed').length,
    failed: urlQueue.filter(u => u.status === 'failed').length,
    skipped: urlQueue.filter(u => u.status === 'skipped').length,
  };

  // ============================================================================
  // URL MANAGEMENT HANDLERS
  // ============================================================================

  const validateAndAddUrls = useCallback((urls: string[], priority: PriorityURLItem['priority']) => {
    const errors: string[] = [];
    const validUrls: PriorityURLItem[] = [];
    const existingUrlSet = new Set([
      ...urlQueue.map(u => normalizeUrl(u.url)),
      ...excludedUrls.map(u => normalizeUrl(u))
    ]);

    urls.forEach((rawUrl, index) => {
      const url = rawUrl.trim();
      if (!url) return;

      // Validate URL format
      if (!isValidUrl(url)) {
        errors.push(`Line ${index + 1}: Invalid URL format - "${url.substring(0, 50)}..."`);
        return;
      }

      const normalizedUrl = normalizeUrl(url);

      // Check for duplicates
      if (existingUrlSet.has(normalizedUrl)) {
        errors.push(`Line ${index + 1}: Duplicate or excluded URL - "${normalizedUrl.substring(0, 50)}..."`);
        return;
      }

      // Check against excluded categories (simple pattern matching)
      const isExcludedByCategory = excludedCategories.some(cat => 
        normalizedUrl.toLowerCase().includes(cat.toLowerCase())
      );
      if (isExcludedByCategory) {
        errors.push(`Line ${index + 1}: URL matches excluded category - "${normalizedUrl.substring(0, 50)}..."`);
        return;
      }

      existingUrlSet.add(normalizedUrl);
      validUrls.push({
        id: generateUniqueId(),
        url: normalizedUrl,
        priority,
        status: 'queued',
        addedAt: Date.now(),
        retryCount: 0,
      });
    });

    if (errors.length > 0) {
      setValidationErrors(errors.slice(0, 5)); // Show max 5 errors
      setTimeout(() => setValidationErrors([]), 10000);
    }

    if (validUrls.length > 0) {
      // Sort by priority: critical > high > medium > low
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const sortedNewUrls = validUrls.sort((a, b) => 
        priorityOrder[a.priority] - priorityOrder[b.priority]
      );
      
      setUrlQueue(prev => {
        const combined = [...sortedNewUrls, ...prev];
        // Re-sort entire queue by priority
        return combined.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
      });
    }

    return validUrls.length;
  }, [urlQueue, excludedUrls, excludedCategories]);

  const handleAddSingleURL = useCallback(() => {
    const count = validateAndAddUrls([singleURL], defaultPriority);
    if (count && count > 0) {
      setSingleURL('');
    }
  }, [singleURL, defaultPriority, validateAndAddUrls]);

  const handleAddBulkURLs = useCallback(() => {
    const urls = bulkURLs.split('\n').filter(u => u.trim());
    const count = validateAndAddUrls(urls, defaultPriority);
    if (count && count > 0) {
      setBulkURLs('');
    }
  }, [bulkURLs, defaultPriority, validateAndAddUrls]);

  const handleFileImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      let urls: string[] = [];
      
      // Handle CSV files
      if (file.name.endsWith('.csv')) {
        const lines = content.split('\n');
        urls = lines.map(line => {
          // Try to extract URL from CSV (first column or column containing http)
          const cols = line.split(',');
          const urlCol = cols.find(c => c.includes('http')) || cols[0];
          return urlCol?.replace(/"/g, '').trim() || '';
        });
      } else {
        // Plain text - one URL per line
        urls = content.split('\n');
      }

      validateAndAddUrls(urls.filter(u => u.trim()), defaultPriority);
    };
    reader.readAsText(file);
  }, [defaultPriority, validateAndAddUrls]);

  const handleRemoveURL = useCallback((id: string) => {
    setUrlQueue(prev => prev.filter(u => u.id !== id));
  }, []);

  const handleUpdatePriority = useCallback((id: string, priority: PriorityURLItem['priority']) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    setUrlQueue(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, priority } : u);
      return updated.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    });
  }, []);

  const handleRetryFailed = useCallback((id: string) => {
    setUrlQueue(prev => prev.map(u => 
      u.id === id ? { ...u, status: 'queued', retryCount: u.retryCount + 1, errorMessage: undefined } : u
    ));
  }, []);

  const handleClearCompleted = useCallback(() => {
    setUrlQueue(prev => prev.filter(u => u.status !== 'completed'));
  }, []);

  const handleClearAll = useCallback(() => {
    if (confirm('Are you sure you want to clear the entire URL queue? This action cannot be undone.')) {
      setUrlQueue([]);
      onClearQueue?.();
    }
  }, [onClearQueue]);

  const handleStartProcessing = useCallback(() => {
    const queuedUrls = urlQueue.filter(u => u.status === 'queued');
    if (queuedUrls.length === 0) {
      alert('No URLs in queue to process. Add some URLs first.');
      return;
    }
    onStartProcessing(queuedUrls);
  }, [urlQueue, onStartProcessing]);

  // Drag and Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find(f => 
      f.type === 'text/plain' || 
      f.type === 'text/csv' || 
      f.name.endsWith('.txt') || 
      f.name.endsWith('.csv')
    );
    
    if (validFile) {
      handleFileImport(validFile);
    }
  }, [handleFileImport]);

  // Filter URLs for display
  const filteredUrls = urlQueue.filter(u => {
    const matchesSearch = !searchFilter || 
      u.url.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
      border: isGodModeActive ? '2px solid #10B981' : '2px solid #334155',
      borderRadius: '16px',
      padding: '0',
      marginBottom: '24px',
      boxShadow: isGodModeActive 
        ? '0 0 40px rgba(16, 185, 129, 0.15), 0 20px 60px rgba(0,0,0,0.6)' 
        : '0 20px 60px rgba(0,0,0,0.6)',
      transition: 'all 0.3s ease',
      overflow: 'hidden',
    }}>
      {/* HEADER */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 24px',
          cursor: 'pointer',
          background: isGodModeActive 
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 78, 59, 0.2))' 
            : 'rgba(30, 41, 59, 0.5)',
          borderBottom: isExpanded ? '1px solid rgba(51, 65, 85, 0.5)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: isGodModeActive 
              ? 'linear-gradient(135deg, #10B981, #059669)' 
              : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            🎯
          </div>
          <div>
            <h3 style={{
              margin: '0 0 4px 0',
              fontSize: '18px',
              fontWeight: '700',
              background: isGodModeActive 
                ? 'linear-gradient(135deg, #10B981, #34D399)' 
                : 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
            }}>
              PRIORITY URL QUEUE
            </h3>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#94A3B8',
              fontWeight: '500',
            }}>
              Add specific URLs for targeted God Mode optimization
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Queue Stats Pills */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              background: 'rgba(148, 163, 184, 0.2)',
              color: '#94A3B8',
            }}>
              {queueStats.total} Total
            </span>
            {queueStats.queued > 0 && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#3B82F6',
              }}>
                {queueStats.queued} Queued
              </span>
            )}
            {queueStats.completed > 0 && (
              <span style={{
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10B981',
              }}>
                {queueStats.completed} Done
              </span>
            )}
          </div>
          
          <span style={{
            fontSize: '24px',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            color: '#64748B',
          }}>
            ▼
          </span>
        </div>
      </div>

      {/* EXPANDED CONTENT */}
      {isExpanded && (
        <div style={{ padding: '24px' }}>
          {/* Input Mode Tabs */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '20px',
            padding: '6px',
            background: 'rgba(15, 23, 42, 0.5)',
            borderRadius: '12px',
          }}>
            {(['single', 'bulk', 'import'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setInputMode(mode)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: inputMode === mode 
                    ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)' 
                    : 'transparent',
                  border: 'none',
                  color: inputMode === mode ? 'white' : '#94A3B8',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  textTransform: 'capitalize',
                }}
              >
                {mode === 'single' ? '🔗 Single URL' : mode === 'bulk' ? '📋 Bulk Import' : '📁 File Upload'}
              </button>
            ))}
          </div>

          {/* Priority Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '20px',
            padding: '12px 16px',
            background: 'rgba(51, 65, 85, 0.2)',
            borderRadius: '10px',
          }}>
            <label style={{
              color: '#E2E8F0',
              fontSize: '13px',
              fontWeight: '600',
            }}>Default Priority:</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setDefaultPriority(p)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: defaultPriority === p ? 'none' : `1px solid ${getPriorityColor(p)}40`,
                    background: defaultPriority === p ? getPriorityColor(p) : 'transparent',
                    color: defaultPriority === p ? 'white' : getPriorityColor(p),
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'capitalize',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div style={{
              padding: '12px 16px',
              marginBottom: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
            }}>
              <div style={{ color: '#EF4444', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
                ⚠️ Validation Issues:
              </div>
              {validationErrors.map((err, i) => (
                <div key={i} style={{ color: '#FCA5A5', fontSize: '12px', marginBottom: '4px' }}>
                  {err}
                </div>
              ))}
            </div>
          )}

          {/* INPUT MODES */}
          {inputMode === 'single' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#E2E8F0',
                fontSize: '13px',
                fontWeight: '600',
              }}>Enter URL to Optimize</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={singleURL}
                  onChange={(e) => setSingleURL(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSingleURL()}
                  placeholder="https://example.com/page-to-optimize"
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    background: '#020617',
                    border: '1px solid #334155',
                    borderRadius: '10px',
                    color: '#E2E8F0',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                />
                <button
                  onClick={handleAddSingleURL}
                  disabled={!singleURL.trim()}
                  style={{
                    padding: '14px 24px',
                    background: singleURL.trim() ? 'linear-gradient(135deg, #10B981, #059669)' : '#334155',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: '700',
                    cursor: singleURL.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  + Add to Queue
                </button>
              </div>
            </div>
          )}

          {inputMode === 'bulk' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#E2E8F0',
                fontSize: '13px',
                fontWeight: '600',
              }}>Enter URLs (one per line)</label>
              <textarea
                value={bulkURLs}
                onChange={(e) => setBulkURLs(e.target.value)}
                placeholder="https://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3\n\nPaste multiple URLs here, one per line..."
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#E2E8F0',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  resize: 'vertical',
                  minHeight: '140px',
                  outline: 'none',
                  lineHeight: '1.6',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ color: '#64748B', fontSize: '12px' }}>
                  {bulkURLs.split('\n').filter(u => u.trim()).length} URLs detected
                </span>
                <button
                  onClick={handleAddBulkURLs}
                  disabled={!bulkURLs.trim()}
                  style={{
                    padding: '12px 24px',
                    background: bulkURLs.trim() ? 'linear-gradient(135deg, #10B981, #059669)' : '#334155',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: '700',
                    cursor: bulkURLs.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  + Add All to Queue
                </button>
              </div>
            </div>
          )}

          {inputMode === 'import' && (
            <div 
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                marginBottom: '20px',
                padding: '40px',
                border: `2px dashed ${isDragging ? '#10B981' : '#334155'}`,
                borderRadius: '12px',
                background: isDragging ? 'rgba(16, 185, 129, 0.1)' : 'rgba(2, 6, 23, 0.5)',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFileImport(e.target.files[0])}
              />
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
              <div style={{ color: '#E2E8F0', fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                {isDragging ? 'Drop file here!' : 'Drag & Drop or Click to Upload'}
              </div>
              <div style={{ color: '#64748B', fontSize: '13px' }}>
                Supports .txt and .csv files with one URL per line
              </div>
            </div>
          )}

          {/* URL QUEUE LIST */}
          {urlQueue.length > 0 && (
            <div style={{
              marginTop: '24px',
              background: 'rgba(2, 6, 23, 0.5)',
              borderRadius: '12px',
              border: '1px solid #1E293B',
              overflow: 'hidden',
            }}>
              {/* Queue Header with Filters */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                borderBottom: '1px solid #1E293B',
                background: 'rgba(30, 41, 59, 0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h4 style={{
                    margin: 0,
                    color: '#E2E8F0',
                    fontSize: '14px',
                    fontWeight: '700',
                  }}>
                    📋 URL Queue ({filteredUrls.length})
                  </h4>
                  <input
                    type="text"
                    placeholder="Search URLs..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      background: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#E2E8F0',
                      fontSize: '12px',
                      width: '180px',
                      outline: 'none',
                    }}
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={{
                      padding: '6px 12px',
                      background: '#0F172A',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#E2E8F0',
                      fontSize: '12px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">All Status</option>
                    <option value="queued">Queued</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {queueStats.completed > 0 && (
                    <button
                      onClick={handleClearCompleted}
                      style={{
                        padding: '6px 12px',
                        background: 'transparent',
                        border: '1px solid #334155',
                        borderRadius: '6px',
                        color: '#94A3B8',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      Clear Completed
                    </button>
                  )}
                  <button
                    onClick={handleClearAll}
                    style={{
                      padding: '6px 12px',
                      background: 'transparent',
                      border: '1px solid #EF4444',
                      borderRadius: '6px',
                      color: '#EF4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Queue Items */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredUrls.map((item, index) => (
                  <div 
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: index < filteredUrls.length - 1 ? '1px solid #1E293B' : 'none',
                      background: item.status === 'processing' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    {/* Status Icon */}
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: `${getStatusColor(item.status)}20`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      flexShrink: 0,
                    }}>
                      {getStatusIcon(item.status)}
                    </div>

                    {/* URL & Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: '#E2E8F0',
                        fontSize: '13px',
                        fontWeight: '500',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.url}
                      </div>
                      {item.errorMessage && (
                        <div style={{ color: '#FCA5A5', fontSize: '11px', marginTop: '2px' }}>
                          Error: {item.errorMessage}
                        </div>
                      )}
                    </div>

                    {/* Priority Selector */}
                    <select
                      value={item.priority}
                      onChange={(e) => handleUpdatePriority(item.id, e.target.value as any)}
                      disabled={item.status !== 'queued'}
                      style={{
                        padding: '4px 8px',
                        background: `${getPriorityColor(item.priority)}20`,
                        border: `1px solid ${getPriorityColor(item.priority)}`,
                        borderRadius: '4px',
                        color: getPriorityColor(item.priority),
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: item.status === 'queued' ? 'pointer' : 'not-allowed',
                        outline: 'none',
                        textTransform: 'uppercase',
                      }}
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {item.status === 'failed' && (
                        <button
                          onClick={() => handleRetryFailed(item.id)}
                          title="Retry"
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(245, 158, 11, 0.2)',
                            border: '1px solid #F59E0B',
                            borderRadius: '4px',
                            color: '#F59E0B',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          🔄 Retry
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveURL(item.id)}
                        title="Remove from queue"
                        style={{
                          padding: '4px 8px',
                          background: 'transparent',
                          border: '1px solid #475569',
                          borderRadius: '4px',
                          color: '#94A3B8',
                          fontSize: '11px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTION BUTTON */}
          {queueStats.queued > 0 && (
            <button
              onClick={handleStartProcessing}
              disabled={isProcessing || !isGodModeActive}
              style={{
                width: '100%',
                marginTop: '24px',
                padding: '16px 24px',
                background: isProcessing 
                  ? '#334155' 
                  : !isGodModeActive 
                    ? '#475569'
                    : 'linear-gradient(135deg, #10B981, #059669)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '700',
                fontSize: '15px',
                cursor: isProcessing || !isGodModeActive ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: isProcessing || !isGodModeActive 
                  ? 'none' 
                  : '0 8px 24px rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              {isProcessing ? (
                <>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  PROCESSING PRIORITY QUEUE...
                </>
              ) : !isGodModeActive ? (
                <>
                  🔒 ENABLE GOD MODE TO START
                </>
              ) : (
                <>
                  🚀 START OPTIMIZING {queueStats.queued} URLs
                </>
              )}
            </button>
          )}

          {/* Help Text */}
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '8px',
            borderLeft: '3px solid #3B82F6',
          }}>
            <div style={{ color: '#93C5FD', fontSize: '12px', lineHeight: '1.6' }}>
              💡 <strong>Pro Tip:</strong> URLs added here will be prioritized over automatic sitemap scanning. 
              Critical priority URLs are processed first, followed by high, medium, and low priority.
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

GodModeURLInput.displayName = 'GodModeURLInput';

export default GodModeURLInput;
