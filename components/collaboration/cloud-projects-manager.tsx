'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import {
  listProjects as listCloudProjects,
  deleteProject as deleteCloudProject,
  updateProject as updateCloudProject,
  hasUserProfile,
  type Project,
} from '@/lib/api';
import { UserSetup } from './user-setup';
import { JoinProject } from './join-project';

interface CloudProjectsManagerProps {
  onOpenProject: (project: Project, role: 'owner' | 'editor' | 'viewer') => void;
}

export function CloudProjectsManager({ onOpenProject }: CloudProjectsManagerProps) {
  const [isUserReady, setIsUserReady] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingProject, setRenamingProject] = useState<Project | null>(null);
  const [renamingName, setRenamingName] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const cloudProjects = await listCloudProjects();
      setProjects(cloudProjects);
    } catch (err) {
      console.error('Failed to load cloud projects:', err);
      setError('Failed to load cloud projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasUserProfile()) {
      setIsUserReady(true);
      loadProjects();
    } else {
      setIsLoading(false);
    }
  }, [loadProjects]);

  const handleUserReady = () => {
    setIsUserReady(true);
    loadProjects();
  };

  const handleDeleteProject = async (id: string) => {
    setError(null);
    try {
      await deleteCloudProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Failed to delete project');
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

    setError(null);
    try {
      const updated = await updateCloudProject(projectId, { name: trimmedName });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? updated : p))
      );
    } catch (err) {
      console.error('Failed to rename project:', err);
      setError('Failed to rename project');
    }
    
    setRenamingProject(null);
    setRenamingName('');
  };

  const handleProjectJoined = (project: Project, role: string) => {
    setProjects((prev) => {
      // Remove existing if present, then add new
      const filtered = prev.filter((p) => p.id !== project.id);
      return [...filtered, project];
    });
    setShowJoin(false);
    onOpenProject(project, role as 'owner' | 'editor' | 'viewer');
  };

  const getProjectRole = (project: Project): 'owner' | 'editor' | 'viewer' => {
    // Check if user is owner
    const userId = localStorage.getItem('userId');
    if (project.ownerId === userId) return 'owner';
    
    // Check membership
    const membership = project.members?.find((m) => m.userId === userId);
    if (membership) return membership.role as 'editor' | 'viewer';
    
    // Default to viewer
    return 'viewer';
  };

  if (!isUserReady) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Cloud Projects</h3>
          <p className="text-sm text-muted-foreground">
            Set up your profile to collaborate on projects with others
          </p>
        </div>
        <UserSetup onUserReady={handleUserReady} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">Loading cloud projects...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Cloud Projects</h3>
          <p className="text-sm text-muted-foreground">
            Collaborate with others on shared translation projects
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowJoin(!showJoin)}>
          {showJoin ? 'Cancel' : 'Join Project'}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      {showJoin && (
        <JoinProject onJoined={handleProjectJoined} />
      )}

      {projects.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No cloud projects yet.</p>
          <p className="text-xs mt-1">
            Upload a project to the cloud or join one with an invite code.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => {
            const role = getProjectRole(project);
            return (
              <div
                key={project.id}
                className="group flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onOpenProject(project, role)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{project.name}</h3>
                    <Badge
                      variant={role === 'owner' ? 'default' : role === 'editor' ? 'secondary' : 'outline'}
                      className="text-[10px]"
                    >
                      {role}
                    </Badge>
                  </div>
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
                {role === 'owner' && (
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
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete cloud project?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &quot;{project.name}&quot; from the cloud.
                            All collaborators will lose access.
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
