'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  listInviteCodes,
  createInviteCode,
  deleteInviteCode,
  type InviteCode,
} from '@/lib/api';

interface InviteCodesManagerProps {
  projectId: string;
  projectName: string;
  embedded?: boolean;
}

export function InviteCodesManager({ projectId, projectName }: InviteCodesManagerProps) {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newRole, setNewRole] = useState<'editor' | 'viewer'>('editor');
  const [maxUses, setMaxUses] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInviteCodes = useCallback(async () => {
    try {
      const codes = await listInviteCodes(projectId);
      setInviteCodes(codes);
    } catch (err) {
      console.error('Failed to load invite codes:', err);
      setError('Failed to load invite codes');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadInviteCodes();
  }, [loadInviteCodes]);

  const handleCreate = async () => {
    setIsCreating(true);
    setError(null);
    try {
      const code = await createInviteCode(projectId, {
        role: newRole,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      });
      setInviteCodes((prev) => [...prev, code]);
      setMaxUses('');
    } catch (err) {
      console.error('Failed to create invite code:', err);
      setError('Failed to create invite code');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (codeId: string) => {
    setError(null);
    try {
      await deleteInviteCode(projectId, codeId);
      setInviteCodes((prev) => prev.filter((c) => c.id !== codeId));
    } catch (err) {
      console.error('Failed to delete invite code:', err);
      setError('Failed to delete invite code');
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="py-4">
        <div className="animate-pulse text-muted-foreground text-sm">Loading invite codes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Share invite codes to allow others to collaborate on &quot;{projectName}&quot;
      </p>
      
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
          {error}
        </div>
      )}
      
      {/* Create new invite code */}
      <div className="flex flex-col gap-3 p-3 bg-muted/50 rounded-lg">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={newRole} onValueChange={(v) => setNewRole(v as 'editor' | 'viewer')}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Max uses"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="w-24"
          />
          <Button size="sm" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Editors can modify translations. Viewers can only view.
        </p>
      </div>

      {/* List of invite codes */}
      {inviteCodes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">
          No invite codes yet.
        </p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {inviteCodes.map((code) => (
            <div
              key={code.id}
              className="flex items-center justify-between p-2 bg-background border rounded-md text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded truncate">
                  {code.code}
                </code>
                <Badge variant={code.role === 'editor' ? 'default' : 'secondary'} className="text-[10px]">
                  {code.role}
                </Badge>
                {code.maxUses && (
                  <span className="text-xs text-muted-foreground">
                    {code.uses}/{code.maxUses}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => copyToClipboard(code.code)}
                >
                  {copiedCode === code.code ? 'Copied!' : 'Copy'}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive">
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Invite Code</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure? Anyone who hasn&apos;t used this code yet won&apos;t be able to join.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(code.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
