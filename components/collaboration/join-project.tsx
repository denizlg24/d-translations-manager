'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { joinProject, type Project } from '@/lib/api';

interface JoinProjectProps {
  onJoined: (project: Project, role: string) => void;
}

export function JoinProject({ onJoined }: JoinProjectProps) {
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (!code.trim()) return;

    setIsJoining(true);
    setError(null);

    try {
      const result = await joinProject(code.trim());
      setCode('');
      onJoined(result.project, result.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join project');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Join a Project</CardTitle>
        <CardDescription>
          Enter an invite code to join an existing project
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-code">Invite Code</Label>
          <div className="flex gap-2">
            <Input
              id="invite-code"
              placeholder="Enter invite code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="flex-1 font-mono"
            />
            <Button onClick={handleJoin} disabled={!code.trim() || isJoining}>
              {isJoining ? 'Joining...' : 'Join'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
