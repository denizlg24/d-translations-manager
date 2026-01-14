'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrCreateUser, updateUser, type User } from '@/lib/api';

interface UserSetupProps {
  onUserReady: (user: User) => void;
}

export function UserSetup({ onUserReady }: UserSetupProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [existingUser, setExistingUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user already exists
    getOrCreateUser()
      .then((user) => {
        if (user.email) {
          setExistingUser(user);
          setName(user.name || '');
          setEmail(user.email);
          onUserReady(user);
        }
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [onUserReady]);

  const handleSave = async () => {
    if (!email.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const user = await updateUser({ name: name.trim() || undefined, email: email.trim() });
      setExistingUser(user);
      setIsEditing(false);
      onUserReady(user);
    } catch (err) {
      console.error('Failed to save user:', err);
      setError('Failed to save user settings');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (existingUser && !isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Profile</CardTitle>
          <CardDescription>Your collaboration identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Name</Label>
            <p className="text-sm font-medium">{existingUser.name || 'Not set'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Email</Label>
            <p className="text-sm font-medium">{existingUser.email}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {existingUser ? 'Edit Profile' : 'Set Up Your Profile'}
        </CardTitle>
        <CardDescription>
          {existingUser
            ? 'Update your collaboration identity'
            : 'To collaborate on projects, please set up your profile'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
            {error}
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used to identify you when collaborating with others
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!email.trim() || isLoading}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
          {existingUser && (
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
