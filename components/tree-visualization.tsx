'use client';

import { useState, useMemo, memo } from 'react';
import { KeyNode, getValueByPath } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';

interface TreeVisualizationProps {
  tree: KeyNode[];
  masterData: Record<string, unknown>;
  translations: Record<string, Record<string, unknown>>;
  targetLanguages: string[];
  onSelectKey: (path: string) => void;
  onNavigate: (path: string[]) => void;
}

interface NodeStats {
  totalKeys: number;
  translatedKeys: number;
  partialKeys: number;
  missingKeys: number;
}

function calculateNodeStats(
  node: KeyNode,
  translations: Record<string, Record<string, unknown>>,
  targetLanguages: string[]
): NodeStats {
  const stats: NodeStats = {
    totalKeys: 0,
    translatedKeys: 0,
    partialKeys: 0,
    missingKeys: 0,
  };

  function traverse(n: KeyNode) {
    if (n.isLeaf) {
      stats.totalKeys++;
      
      if (targetLanguages.length === 0) {
        return;
      }

      let translatedCount = 0;
      for (const lang of targetLanguages) {
        const value = getValueByPath(translations[lang] || {}, n.path);
        if (value !== undefined && value !== '' && value !== null) {
          translatedCount++;
        }
      }

      if (translatedCount === targetLanguages.length) {
        stats.translatedKeys++;
      } else if (translatedCount > 0) {
        stats.partialKeys++;
      } else {
        stats.missingKeys++;
      }
    } else {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return stats;
}

interface TreeNodeProps {
  node: KeyNode;
  masterData: Record<string, unknown>;
  translations: Record<string, Record<string, unknown>>;
  targetLanguages: string[];
  depth: number;
  onSelectKey: (path: string) => void;
  onNavigate: (path: string[]) => void;
  defaultExpanded?: boolean;
}

function TreeNode({
  node,
  masterData,
  translations,
  targetLanguages,
  depth,
  onSelectKey,
  onNavigate,
  defaultExpanded = false,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 1);

  const masterValue = node.isLeaf ? getValueByPath(masterData, node.path) : null;

  // Calculate stats for this node (for folders, includes all descendants)
  const nodeStats = useMemo(() => {
    return calculateNodeStats(node, translations, targetLanguages);
  }, [node, translations, targetLanguages]);

  // Check translation status for leaf nodes
  const translationStatus = useMemo(() => {
    if (!node.isLeaf) return null;

    const langStatuses: Record<string, boolean> = {};
    let translated = 0;
    
    for (const lang of targetLanguages) {
      const value = getValueByPath(translations[lang] || {}, node.path);
      const hasTranslation = value !== undefined && value !== '' && value !== null;
      langStatuses[lang] = hasTranslation;
      if (hasTranslation) {
        translated++;
      }
    }

    return {
      translated,
      total: targetLanguages.length,
      complete: translated === targetLanguages.length && targetLanguages.length > 0,
      partial: translated > 0 && translated < targetLanguages.length,
      missing: translated === 0,
      langStatuses,
    };
  }, [node.path, node.isLeaf, targetLanguages, translations]);

  const handleClick = () => {
    if (node.isLeaf) {
      onSelectKey(node.path);
    } else {
      setExpanded(!expanded);
    }
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const pathParts = node.path.split('.');
    onNavigate(pathParts);
  };

  // Calculate progress percentage for folders
  const folderProgress = useMemo(() => {
    if (node.isLeaf || nodeStats.totalKeys === 0 || targetLanguages.length === 0) return 0;
    return Math.round((nodeStats.translatedKeys / nodeStats.totalKeys) * 100);
  }, [node.isLeaf, nodeStats, targetLanguages.length]);

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        className={`
          group flex items-start gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors
          hover:bg-muted/50
          ${node.isLeaf && translationStatus?.missing && targetLanguages.length > 0 ? 'bg-red-500/5' : ''}
        `}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/Collapse or Leaf indicator */}
        <div className="w-4 h-5 flex items-center justify-center shrink-0">
          {!node.isLeaf ? (
            <svg
              className={`size-3 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <div
              className={`size-2 rounded-full ${
                translationStatus?.complete
                  ? 'bg-green-500'
                  : translationStatus?.partial
                    ? 'bg-yellow-500'
                    : targetLanguages.length > 0
                      ? 'bg-red-500'
                      : 'bg-muted-foreground/30'
              }`}
            />
          )}
        </div>

        {/* Node name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-mono text-xs ${node.isLeaf ? '' : 'font-medium'}`}>
              {node.name}
            </span>

            {/* Folder stats */}
            {!node.isLeaf && (
              <>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                  {nodeStats.totalKeys} key{nodeStats.totalKeys !== 1 ? 's' : ''}
                </Badge>
                
                {targetLanguages.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          folderProgress === 100
                            ? 'bg-green-500'
                            : folderProgress > 0
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${folderProgress}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground tabular-nums">
                      {folderProgress}%
                    </span>
                  </div>
                ) : null}

                <button
                  onClick={handleNavigate}
                  className="opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-foreground transition-opacity"
                >
                  Open →
                </button>
              </>
            )}

            {/* Leaf node translation status */}
            {node.isLeaf && translationStatus && targetLanguages.length > 0 ? (
              <div className="flex items-center gap-1">
                {targetLanguages.map((lang) => (
                  <span
                    key={lang}
                    className={`text-[9px] px-1 py-0.5 rounded font-mono ${
                      translationStatus.langStatuses[lang]
                        ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                        : 'bg-red-500/20 text-red-700 dark:text-red-400'
                    }`}
                    title={`${lang}: ${translationStatus.langStatuses[lang] ? 'Translated' : 'Missing'}`}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Full path for leaf nodes */}
          {node.isLeaf && node.path.includes('.') ? (
            <div className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
              {node.path}
            </div>
          ) : null}

          {/* Value preview for leaf nodes */}
          {node.isLeaf && masterValue !== null && masterValue !== undefined ? (
            <div className="text-[11px] text-muted-foreground truncate mt-0.5 max-w-md">
              &quot;{String(masterValue).slice(0, 80)}
              {String(masterValue).length > 80 ? '...' : ''}&quot;
            </div>
          ) : null}

          {/* Folder breakdown */}
          {!node.isLeaf && targetLanguages.length > 0 && nodeStats.totalKeys > 0 && expanded ? (
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              {nodeStats.translatedKeys > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  {nodeStats.translatedKeys} complete
                </span>
              ) : null}
              {nodeStats.partialKeys > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-yellow-500" />
                  {nodeStats.partialKeys} partial
                </span>
              ) : null}
              {nodeStats.missingKeys > 0 ? (
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-red-500" />
                  {nodeStats.missingKeys} missing
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Children */}
      {!node.isLeaf && expanded && (
        <div className="relative">
          {/* Vertical line connector */}
          <div
            className="absolute top-0 bottom-0 w-px bg-border"
            style={{ left: `${depth * 16 + 16}px` }}
          />
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              masterData={masterData}
              translations={translations}
              targetLanguages={targetLanguages}
              depth={depth + 1}
              onSelectKey={onSelectKey}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const TreeVisualization = memo(function TreeVisualization({
  tree,
  masterData,
  translations,
  targetLanguages,
  onSelectKey,
  onNavigate,
}: TreeVisualizationProps) {
  // Calculate overall stats
  const stats = useMemo(() => {
    let totalKeys = 0;
    let translatedKeys = 0;
    let partialKeys = 0;
    let missingKeys = 0;
    let totalGroups = 0;

    function countNodes(nodes: KeyNode[]) {
      for (const node of nodes) {
        if (node.isLeaf) {
          totalKeys++;

          if (targetLanguages.length === 0) continue;

          let translatedCount = 0;
          for (const lang of targetLanguages) {
            const value = getValueByPath(translations[lang] || {}, node.path);
            if (value !== undefined && value !== '' && value !== null) {
              translatedCount++;
            }
          }

          if (translatedCount === targetLanguages.length) {
            translatedKeys++;
          } else if (translatedCount > 0) {
            partialKeys++;
          } else {
            missingKeys++;
          }
        } else {
          totalGroups++;
          countNodes(node.children);
        }
      }
    }

    countNodes(tree);

    return {
      totalKeys,
      translatedKeys,
      partialKeys,
      missingKeys,
      totalGroups,
      progress: totalKeys > 0 && targetLanguages.length > 0
        ? Math.round((translatedKeys / totalKeys) * 100)
        : 0,
    };
  }, [tree, translations, targetLanguages]);

  // Per-language stats
  const languageStats = useMemo(() => {
    const langStats: Record<string, { translated: number; total: number }> = {};
    
    for (const lang of targetLanguages) {
      langStats[lang] = { translated: 0, total: 0 };
    }

    function countLeafNodes(nodes: KeyNode[]) {
      for (const node of nodes) {
        if (node.isLeaf) {
          for (const lang of targetLanguages) {
            langStats[lang].total++;
            const value = getValueByPath(translations[lang] || {}, node.path);
            if (value !== undefined && value !== '' && value !== null) {
              langStats[lang].translated++;
            }
          }
        } else {
          countLeafNodes(node.children);
        }
      }
    }

    countLeafNodes(tree);
    return langStats;
  }, [tree, translations, targetLanguages]);

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No translation keys found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats Header */}
      <div className="shrink-0 border-b border-border bg-muted/30">
        <div className="flex sm:flex-row flex-col sm:text-left text-center items-center justify-between px-4 py-3  gap-4">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-lg font-semibold tabular-nums">{stats.totalKeys}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Keys
              </div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-lg font-semibold tabular-nums">{stats.totalGroups}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Namespaces
              </div>
            </div>
          </div>

          {targetLanguages.length > 0 ? (
            <div className="flex items-center gap-3 sm:w-auto w-full">
              <div className="sm:text-right text-left">
                <div className="text-lg font-semibold tabular-nums">
                  {stats.translatedKeys}/{stats.totalKeys}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Fully Translated
                </div>
              </div>
              <div className="sm:w-24 sm:grow-0 grow h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${stats.progress}%` }}
                />
              </div>
              <span className="text-sm font-medium tabular-nums w-10">{stats.progress}%</span>
            </div>
          ) : null}
        </div>

        {/* Per-language progress */}
        {targetLanguages.length > 0 ? (
          <div className="px-4 py-2 border-t border-border/50 flex flex-wrap gap-4">
            {targetLanguages.map((lang) => {
              const langStat = languageStats[lang];
              const langProgress = langStat.total > 0
                ? Math.round((langStat.translated / langStat.total) * 100)
                : 0;
              return (
                <div key={lang} className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-medium uppercase">{lang}</span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        langProgress === 100 ? 'bg-green-500' : langProgress > 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${langProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {langStat.translated}/{langStat.total}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Summary badges */}
        {targetLanguages.length > 0 && stats.totalKeys > 0 ? (
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border/50 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Complete: {stats.translatedKeys}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">Partial: {stats.partialKeys}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Missing: {stats.missingKeys}</span>
            </div>
          </div>
        ) : null}

        {/* No languages warning */}
        {targetLanguages.length === 0 ? (
          <div className="px-4 py-2 border-t border-border/50 text-[11px] text-amber-600 dark:text-amber-400">
            Add target languages to see translation progress
          </div>
        ) : null}
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto py-2">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            masterData={masterData}
            translations={translations}
            targetLanguages={targetLanguages}
            depth={0}
            onSelectKey={onSelectKey}
            onNavigate={onNavigate}
            defaultExpanded={tree.length <= 5}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="shrink-0 text-center py-2 border-t border-border/50 text-[11px] text-muted-foreground">
        Click a key to translate • Click a namespace to expand • Hover for quick navigation
      </div>
    </div>
  );
});
