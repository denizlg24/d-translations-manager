'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  useMemo,
} from 'react';
import {
  TranslationProject,
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  flattenKeys,
  getValueByPath,
  setValueByPath,
  buildKeyTree,
  KeyNode,
} from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download, X } from '@hugeicons/core-free-icons';
import { TreeVisualization } from './tree-visualization';
import { CloudProjectsManager, InviteCodesManager } from './collaboration';
import { 
  type Project as CloudProject, 
  updateProject as updateCloudProject,
  createProject as createCloudProject,
  hasUserProfile,
} from '@/lib/api';

type View = 'home' | 'editor';
type MobilePanel = 'languages' | 'keys' | 'editor';
type HomeTab = 'local' | 'cloud';

// Translation input component - manages its own state completely
// Parent should use a unique key prop to reset when switching translation keys
interface TranslationInputProps {
  lang: string;
  initialValue: string;
  onSave: (lang: string, value: string) => void;
}

const TranslationInput = memo(function TranslationInput({
  lang,
  initialValue,
  onSave,
}: TranslationInputProps) {
  const [localValue, setLocalValue] = useState(initialValue);
  const hasChangedRef = useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    hasChangedRef.current = true;
  };

  // Only update parent state on blur to avoid re-renders during typing
  const handleBlur = () => {
    if (hasChangedRef.current) {
      onSave(lang, localValue);
      hasChangedRef.current = false;
    }
  };

  return (
    <Textarea
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={`Enter ${lang} translation...`}
      className="min-h-20"
    />
  );
});

// Language input component - manages its own state to prevent parent re-renders
interface LanguageInputProps {
  onAdd: (lang: string) => void;
  placeholder?: string;
}

const LanguageInput = memo(function LanguageInput({
  onAdd,
  placeholder = 'e.g. de, fr, es',
}: LanguageInputProps) {
  const [value, setValue] = useState('');

  const handleAdd = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        className="flex-1"
      />
      <Button
        variant="outline"
        size="icon"
        onClick={handleAdd}
        disabled={!value.trim()}
      >
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </Button>
    </div>
  );
});

// Shared expansion state store - persists across re-renders without triggering them
const expansionStore = new Map<string, boolean>();

// Recursive Key Node component with local expanded state
interface KeyNodeItemProps {
  node: KeyNode;
  depth: number;
  selectedKey: string | null;
  onSelectKey: (path: string) => void;
}

const KeyNodeItem = memo(function KeyNodeItem({
  node,
  depth,
  selectedKey,
  onSelectKey,
}: KeyNodeItemProps) {
  // Use local state but initialize from shared store
  const [expanded, setExpanded] = useState(() => expansionStore.get(node.path) ?? false);

  const handleClick = useCallback(() => {
    if (node.isLeaf) {
      onSelectKey(node.path);
    } else {
      setExpanded((prev) => {
        const next = !prev;
        expansionStore.set(node.path, next);
        return next;
      });
    }
  }, [node.isLeaf, node.path, onSelectKey]);

  const isSelected = selectedKey === node.path;
  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
          isSelected
            ? 'bg-primary/10 text-primary'
            : 'hover:bg-muted/50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        {/* Expand/Collapse indicator */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
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
            <div className="size-1.5 rounded-full bg-muted-foreground/40" />
          )}
        </div>

        <span className="font-mono text-xs flex-1 truncate">{node.name}</span>

        {node.isLeaf ? (
          <Badge variant="outline" className="text-[10px] shrink-0">
            value
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground shrink-0">
            {node.children.length}
          </span>
        )}
      </button>

      {/* Children - only render when expanded */}
      {!node.isLeaf && expanded && (
        <div>
          {node.children.map((child) => (
            <KeyNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedKey={selectedKey}
              onSelectKey={onSelectKey}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Memoized Keys Navigator - now uses recursive tree structure
interface KeysNavigatorProps {
  nodes: KeyNode[];
  selectedKey: string | null;
  onSelectKey: (path: string) => void;
  className?: string;
}

const KeysNavigator = memo(function KeysNavigator({
  nodes,
  selectedKey,
  onSelectKey,
  className = '',
}: KeysNavigatorProps) {
  return (
    <div className={`overflow-y-auto h-full ${className}`}>
      {nodes.map((node) => (
        <KeyNodeItem
          key={node.path}
          node={node}
          depth={0}
          selectedKey={selectedKey}
          onSelectKey={onSelectKey}
        />
      ))}

      {nodes.length === 0 && (
        <div className="px-4 py-12 text-center text-muted-foreground text-sm">
          No keys found
        </div>
      )}
    </div>
  );
});

// Memoized Language Progress Item
interface LanguageProgressItemProps {
  lang: string;
  progress: { done: number; total: number };
  onExport: (lang: string) => void;
  onRemove: (lang: string) => void;
}

const LanguageProgressItem = memo(function LanguageProgressItem({
  lang,
  progress,
  onExport,
  onRemove,
}: LanguageProgressItemProps) {
  const percentage = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <Badge variant="outline" className="text-xs">
            {lang}
          </Badge>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {progress.done}/{progress.total}
          </span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onExport(lang)}
          title="Export"
        >
          <HugeiconsIcon icon={Download} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(lang)}
          title="Remove"
        >
          <HugeiconsIcon icon={X} />
        </Button>
      </div>
    </div>
  );
});

export function TranslationManager() {
  const [view, setView] = useState<View>('home');
  const [homeTab, setHomeTab] = useState<HomeTab>('local');
  const [projects, setProjects] = useState<TranslationProject[]>([]);
  const [cloudProjectIds, setCloudProjectIds] = useState<Set<string>>(new Set());
  const [currentProject, setCurrentProject] = useState<TranslationProject | null>(null);
  const [currentCloudProject, setCurrentCloudProject] = useState<CloudProject | null>(null);
  const [cloudProjectRole, setCloudProjectRole] = useState<'owner' | 'editor' | 'viewer'>('viewer');
  const [keyTree, setKeyTree] = useState<KeyNode[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('keys');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [renamingProject, setRenamingProject] = useState<TranslationProject | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out local projects that are also cloud projects
  const localOnlyProjects = useMemo(() => 
    projects.filter(p => !cloudProjectIds.has(p.id)),
    [projects, cloudProjectIds]
  );

  // Keep a stable reference to masterData to prevent unnecessary keyTree rebuilds
  const masterDataRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    listProjects().then(setProjects).catch(console.error);
  }, []);

  // Only rebuild keyTree when masterData actually changes (not translations)
  useEffect(() => {
    if (currentProject && currentProject.masterData !== masterDataRef.current) {
      masterDataRef.current = currentProject.masterData;
      // Use requestIdleCallback for non-blocking tree building, with setTimeout fallback
      const buildTree = () => {
        const keys = flattenKeys(currentProject.masterData);
        setKeyTree(buildKeyTree(keys));
      };
      
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(buildTree);
      } else {
        setTimeout(buildTree, 0);
      }
    }
  }, [currentProject]);

  // Track if a save is in progress
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Manual save function
  const handleSave = useCallback(async () => {
    if (!currentProject || isSaving) return;
    
    setIsSaving(true);
    try {
      // Save to local storage
      await saveProject(currentProject);
      
      // If it's a cloud project, also sync to cloud
      if (currentCloudProject && cloudProjectRole !== 'viewer') {
        await updateCloudProject(currentCloudProject.id, {
          masterData: currentProject.masterData,
          translations: currentProject.translations,
          targetLanguages: currentProject.targetLanguages,
        });
      }
      
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Save failed:', error);
      setNotification({ type: 'error', message: 'Failed to save project. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [currentProject, currentCloudProject, cloudProjectRole, isSaving]);

  // Mark as having unsaved changes when project changes
  const markUnsaved = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const langMatch = file.name.match(/^([a-z]{2}(?:-[A-Z]{2})?)\.json$/);
      const masterLanguage = langMatch ? langMatch[1] : 'en';

      const project: TranslationProject = {
        id: crypto.randomUUID(),
        name: file.name.replace('.json', ''),
        masterLanguage,
        targetLanguages: [],
        masterData: data,
        translations: {},
        lastModified: Date.now(),
      };

      await saveProject(project);
      setCurrentProject(project);
      setCurrentCloudProject(null);  // Clear cloud state for new local project
      setCloudProjectRole('viewer');
      setProjects((prev) => [...prev, project]);
      setSelectedKey(null);
      setView('editor');
    } catch (error) {
      console.error('Failed to parse JSON file:', error);
      setNotification({ type: 'error', message: 'Invalid JSON file. Please upload a valid JSON file.' });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenProject = async (project: TranslationProject) => {
    const loaded = await loadProject(project.id);
    if (loaded) {
      setCurrentProject(loaded);
      setCurrentCloudProject(null);  // Clear cloud state for local project
      setCloudProjectRole('viewer');
      setSelectedKey(null);
      setView('editor');
    }
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddLanguage = useCallback((langInput: string) => {
    if (!langInput.trim()) return;

    setCurrentProject((prev) => {
      if (!prev) return prev;

      const lang = langInput.trim().toLowerCase();
      if (prev.targetLanguages.includes(lang)) {
        return prev;
      }

      const updated: TranslationProject = {
        ...prev,
        targetLanguages: [...prev.targetLanguages, lang],
        translations: {
          ...prev.translations,
          [lang]: {},
        },
      };

      markUnsaved();
      return updated;
    });
  }, [markUnsaved]);

  const handleRemoveLanguage = (lang: string) => {
    if (!currentProject) return;

    const updated: TranslationProject = {
      ...currentProject,
      targetLanguages: currentProject.targetLanguages.filter((l) => l !== lang),
      translations: Object.fromEntries(
        Object.entries(currentProject.translations).filter(([key]) => key !== lang)
      ),
    };

    setCurrentProject(updated);
    markUnsaved();
  };

  const handleTranslationChange = useCallback((lang: string, value: string) => {
    setCurrentProject((prev) => {
      if (!prev || !selectedKey) return prev;

      const updated: TranslationProject = {
        ...prev,
        translations: {
          ...prev.translations,
          [lang]: setValueByPath(prev.translations[lang] || {}, selectedKey, value),
        },
      };

      return updated;
    });
    markUnsaved();
  }, [selectedKey, markUnsaved]);

  const handleExport = (lang: string) => {
    if (!currentProject) return;

    const data = currentProject.translations[lang] || {};
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lang}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    if (!currentProject) return;

    for (const lang of currentProject.targetLanguages) {
      handleExport(lang);
    }
  };

  const handleUploadToCloud = async () => {
    if (!currentProject || currentCloudProject) return;
    
    if (!hasUserProfile()) {
      setNotification({ type: 'error', message: 'Please set up your profile in the Cloud tab first to upload projects.' });
      return;
    }
    
    try {
      const localProjectId = currentProject.id;
      
      const cloudProject = await createCloudProject({
        name: currentProject.name,
        masterLanguage: currentProject.masterLanguage,
        targetLanguages: currentProject.targetLanguages,
        masterData: currentProject.masterData,
        translations: currentProject.translations,
      });
      
      // Delete the local project since it's now in the cloud
      await deleteProject(localProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== localProjectId));
      
      // Update cloudProjectIds to include the new cloud project
      setCloudProjectIds((prev) => new Set([...prev, cloudProject.id]));
      
      setCurrentCloudProject(cloudProject);
      setCloudProjectRole('owner');
      setNotification({ type: 'success', message: 'Project uploaded to cloud successfully! The local copy has been removed.' });
    } catch (error) {
      console.error('Failed to upload to cloud:', error);
      setNotification({ type: 'error', message: 'Failed to upload project to cloud. Please try again.' });
    }
  };

  const handleRenameProject = async (projectId: string, newName: string) => {
    if (!newName.trim()) return;
    
    const trimmedName = newName.trim();
    const project = projects.find(p => p.id === projectId);
    if (!project || trimmedName === project.name) {
      setRenamingProject(null);
      setRenamingName('');
      return;
    }

    const updatedProject = { ...project, name: trimmedName };
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? updatedProject : p))
    );
    
    // Also update currentProject if it's the one being renamed
    if (currentProject?.id === projectId) {
      setCurrentProject(updatedProject);
    }

    // Save to storage
    await saveProject(updatedProject);
    
    setRenamingProject(null);
    setRenamingName('');
  };

  // Handler for selecting a key from the tree navigator
  const handleSelectKey = useCallback((path: string) => {
    setSelectedKey(path);
    setMobilePanel('editor');
  }, []);

  // Memoize all flattened keys to avoid recalculating on every render
  const masterData = currentProject?.masterData;
  const allKeys = useMemo(() => {
    if (!masterData) return [];
    return flattenKeys(masterData);
  }, [masterData]);

  // Lazy translation progress - only calculate when actually needed
  const targetLanguages = currentProject?.targetLanguages;
  const projectTranslations = currentProject?.translations;
  const translationProgressCache = useRef<{
    keys: string[];
    translations: Record<string, Record<string, unknown>> | undefined;
    progress: Record<string, { done: number; total: number }>;
  }>({ keys: [], translations: undefined, progress: {} });

  const getTranslationProgress = useCallback((lang: string): { done: number; total: number } => {
    if (!targetLanguages || !projectTranslations) return { done: 0, total: 0 };
    
    // Check if cache is valid
    const cache = translationProgressCache.current;
    if (cache.keys !== allKeys || cache.translations !== projectTranslations) {
      // Invalidate cache
      cache.keys = allKeys;
      cache.translations = projectTranslations;
      cache.progress = {};
    }
    
    // Return cached value if available
    if (cache.progress[lang]) {
      return cache.progress[lang];
    }
    
    // Calculate and cache
    const langTranslations = projectTranslations[lang] || {};
    let done = 0;
    
    for (const key of allKeys) {
      const value = getValueByPath(langTranslations, key);
      if (value !== undefined && value !== '' && value !== null) {
        done++;
      }
    }
    
    cache.progress[lang] = { done, total: allKeys.length };
    return cache.progress[lang];
  }, [targetLanguages, projectTranslations, allKeys]);

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
          <header className="mb-8 sm:mb-16">
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight mb-2">
              Translations
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage your next-intl translation files
            </p>
          </header>

          {/* Notification banner */}
          {notification && (
            <div
              className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
                notification.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400'
              }`}
            >
              <span className="text-sm">{notification.message}</span>
              <button
                onClick={() => setNotification(null)}
                className="ml-4 text-current opacity-70 hover:opacity-100"
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg mb-8 w-fit">
            <button
              onClick={() => setHomeTab('local')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                homeTab === 'local'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Local
            </button>
            <button
              onClick={() => setHomeTab('cloud')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                homeTab === 'cloud'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Cloud
            </button>
          </div>

          {homeTab === 'local' ? (
            <>
              <section className="mb-8 sm:mb-12">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-24 sm:h-32 border-dashed border-2 hover:border-solid hover:bg-muted/50 transition-all"
                >
                  <div className="flex flex-col items-center gap-2">
                    <svg
                      className="size-5 sm:size-6 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span className="text-muted-foreground text-sm">
                      Import master JSON file
                    </span>
                  </div>
                </Button>
              </section>

              {localOnlyProjects.length > 0 && (
                <section>
                  <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
                    Recent Projects
                  </h2>
                  <div className="space-y-2">
                    {localOnlyProjects.map((project) => (
                      <div
                        key={project.id}
                        className="group flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => handleOpenProject(project)}
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{project.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-[10px]">
                              {project.masterLanguage}
                            </Badge>
                            {project.targetLanguages.length > 0 && (
                              <span className="text-muted-foreground text-xs">
                                → {project.targetLanguages.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Rename button */}
                          <AlertDialog open={renamingProject?.id === project.id} onOpenChange={(open) => {
                            if (open) {
                              setRenamingProject(project);
                              setRenamingName(project.name);
                            } else {
                              setRenamingProject(null);
                              setRenamingName('');
                            }
                          }}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg
                                  className="size-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent size="sm" onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Rename project</AlertDialogTitle>
                              </AlertDialogHeader>
                              <div className="py-4">
                                <Input
                                  value={renamingName}
                                  onChange={(e) => setRenamingName(e.target.value)}
                                  placeholder="Project name"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleRenameProject(project.id, renamingName);
                                    }
                                  }}
                                  autoFocus
                                />
                              </div>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRenameProject(project.id, renamingName);
                                  }}
                                >
                                  Rename
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {/* Delete button */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                              <svg
                                className="size-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent size="sm">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete project?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete &quot;{project.name}&quot; and all translations.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteProject(project.id);
                                }}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <CloudProjectsManager
              onOpenProject={(project, role) => {
                // Convert cloud project to local format for editing
                const localProject: TranslationProject = {
                  id: project.id,
                  name: project.name,
                  masterLanguage: project.masterLanguage,
                  targetLanguages: project.targetLanguages,
                  masterData: project.masterData,
                  translations: project.translations,
                  lastModified: new Date(project.updatedAt).getTime(),
                };
                setCurrentProject(localProject);
                setCurrentCloudProject(project);
                setCloudProjectRole(role);
                setSelectedKey(null);
                setView('editor');
              }}
              onProjectsLoaded={(ids) => setCloudProjectIds(new Set(ids))}
            />
          )}
        </div>
      </div>
    );
  }

  const masterValue = selectedKey
    ? getValueByPath(currentProject!.masterData, selectedKey)
    : null;

  // Languages Panel Component (reused in sidebar and mobile)
  const LanguagesPanel = ({ className = '' }: { className?: string }) => (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div>
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Master
        </h2>
        <Badge variant="secondary" className="text-xs">
          {currentProject?.masterLanguage}
        </Badge>
      </div>

      <Separator />

      <div className="flex-1">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Target Languages
        </h2>

        <div className="space-y-2 mb-4">
          {currentProject?.targetLanguages.map((lang) => (
            <LanguageProgressItem
              key={lang}
              lang={lang}
              progress={getTranslationProgress(lang)}
              onExport={handleExport}
              onRemove={handleRemoveLanguage}
            />
          ))}
        </div>

        <LanguageInput onAdd={handleAddLanguage} />
      </div>
    </div>
  );

  // Keys Navigator Component (reused in panel and mobile)
  const KeysNavigatorPanel = ({ className = '' }: { className?: string }) => (
    <KeysNavigator
      className={className}
      nodes={keyTree}
      selectedKey={selectedKey}
      onSelectKey={handleSelectKey}
    />
  );

  // Translation Editor Component (reused in panel and mobile)
  const TranslationEditor = ({ className = '' }: { className?: string }) => (
    <div className={`overflow-y-auto ${selectedKey? " p-4 md:p-6 " : ""} ${className}`}>
      {selectedKey ? (
        <div className="w-full space-y-6">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              Key
            </label>
            <code className="text-xs font-mono bg-muted px-3 py-2 rounded-md block break-all">
              {selectedKey}
            </code>
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
              Master ({currentProject?.masterLanguage})
            </label>
            <div className="bg-muted/50 border border-border rounded-md px-3 py-2 text-sm">
              {String(masterValue)}
            </div>
          </div>

          <Separator />

          {currentProject?.targetLanguages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Add target languages to start translating
            </div>
          ) : (
            <div className="space-y-4">
              {currentProject?.targetLanguages.map((lang) => {
                const currentValue = getValueByPath(
                  currentProject.translations[lang] || {},
                  selectedKey
                );

                return (
                  <div key={lang}>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-2">
                      {lang}
                    </label>
                    <TranslationInput
                      key={`${lang}-${selectedKey}`}
                      lang={lang}
                      initialValue={String(currentValue || '')}
                      onSave={handleTranslationChange}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <TreeVisualization
          tree={keyTree}
          masterData={currentProject?.masterData || {}}
          translations={currentProject?.translations || {}}
          targetLanguages={currentProject?.targetLanguages || []}
          onSelectKey={(path) => {
            setSelectedKey(path);
            setMobilePanel('editor');
          }}
          onNavigate={() => {
            // Tree navigation now uses local state in KeysNavigator
            setMobilePanel('keys');
          }}
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-4 md:px-6 h-14">
          <div className="flex items-center gap-3 md:gap-4">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setView('home')}
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>
            <div className="min-w-0">
              <h1 className="font-medium text-sm truncate">{currentProject?.name}</h1>
              <p className="text-muted-foreground text-xs">
                {lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Not saved yet'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Upload to Cloud button - only show for local projects not yet in cloud */}
            {!currentCloudProject && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUploadToCloud}
                className="hidden sm:flex"
              >
                Upload to Cloud
              </Button>
            )}
            
            {/* Share button - only show for cloud projects where user is owner */}
            {currentCloudProject && cloudProjectRole === 'owner' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                  >
                    Share
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Share Project</AlertDialogTitle>
                  </AlertDialogHeader>
                  <InviteCodesManager
                    projectId={currentCloudProject.id}
                    projectName={currentCloudProject.name}
                    embedded
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Close</AlertDialogCancel>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            
            {/* Cloud indicator for non-owners */}
            {currentCloudProject && cloudProjectRole !== 'owner' && (
              <Badge variant="secondary" className="hidden sm:flex text-xs">
                {cloudProjectRole === 'editor' ? 'Editor' : 'Viewer'}
              </Badge>
            )}
            
            {/* Save button */}
            <Button
              variant={hasUnsavedChanges ? 'default' : 'outline'}
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="hidden sm:flex"
            >
              {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save' : 'Saved'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={!currentProject?.targetLanguages.length}
              className="hidden sm:flex"
            >
              Export All
            </Button>
            {/* Mobile Save button */}
            <Button
              variant={hasUnsavedChanges ? 'default' : 'outline'}
              size="icon-sm"
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="sm:hidden"
              title={isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save' : 'Saved'}
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
            </Button>
            {/* Mobile Export button */}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={handleExportAll}
              disabled={!currentProject?.targetLanguages.length}
              className="sm:hidden"
              title="Export All"
            >
              <svg
                className="size-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </Button>
          </div>
        </div>
      </header>

      {/* Notification banner */}
      {notification && (
        <div
          className={`px-4 md:px-6 py-3 flex items-center justify-between ${
            notification.type === 'success'
              ? 'bg-green-500/10 border-b border-green-500/20 text-green-700 dark:text-green-400'
              : 'bg-red-500/10 border-b border-red-500/20 text-red-700 dark:text-red-400'
          }`}
        >
          <span className="text-sm">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-4 text-current opacity-70 hover:opacity-100"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Mobile Tab Navigation */}
      <div className="lg:hidden border-b border-border bg-muted/30">
        <div className="flex">
          <button
            onClick={() => setMobilePanel('languages')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              mobilePanel === 'languages'
                ? 'text-primary border-b-2 border-primary bg-background'
                : 'text-muted-foreground'
            }`}
          >
            Languages
          </button>
          <button
            onClick={() => setMobilePanel('keys')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              mobilePanel === 'keys'
                ? 'text-primary border-b-2 border-primary bg-background'
                : 'text-muted-foreground'
            }`}
          >
            Keys
          </button>
          <button
            onClick={() => setMobilePanel('editor')}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              mobilePanel === 'editor'
                ? 'text-primary border-b-2 border-primary bg-background'
                : 'text-muted-foreground'
            }`}
          >
            Editor
          </button>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="flex-1 hidden lg:flex">
        {/* Sidebar - Languages */}
        <aside className="w-64 border-r border-border p-4">
          <LanguagesPanel />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Breadcrumb */}
          <div className="px-6 py-3 border-b border-border bg-muted/30">
            <nav className="flex items-center gap-1 text-sm overflow-x-auto">
              <button
                onClick={() => setSelectedKey(null)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                root
              </button>
              {selectedKey && selectedKey.split('.').map((part, index, arr) => (
                <span key={index} className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground/50">/</span>
                  <span className={index === arr.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    {part}
                  </span>
                </span>
              ))}
            </nav>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Key Navigator */}
            <KeysNavigatorPanel className="w-80 border-r border-border" />

            {/* Translation Editor */}
            <TranslationEditor className="flex-1 w-full" />
          </div>
        </main>
      </div>

      {/* Mobile Layout */}
      <div className="flex-1 lg:hidden flex flex-col overflow-hidden">
        {/* Mobile Breadcrumb (only show on keys panel) */}
        {mobilePanel === 'keys' && (
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <nav className="flex items-center gap-1 text-xs overflow-x-auto">
              <button
                onClick={() => setSelectedKey(null)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                root
              </button>
              {selectedKey && selectedKey.split('.').map((part, index, arr) => (
                <span key={index} className="flex items-center gap-1 shrink-0">
                  <span className="text-muted-foreground/50">/</span>
                  <span className={index === arr.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"}>
                    {part}
                  </span>
                </span>
              ))}
            </nav>
          </div>
        )}

        {/* Mobile Panels */}
        <div className="flex-1 overflow-hidden">
          {mobilePanel === 'languages' && (
            <div className="h-full overflow-y-auto p-4">
              <LanguagesPanel />
            </div>
          )}
          {mobilePanel === 'keys' && (
            <KeysNavigatorPanel className="h-full" />
          )}
          {mobilePanel === 'editor' && (
            <TranslationEditor className="h-full" />
          )}
        </div>
      </div>
    </div>
  );
}
