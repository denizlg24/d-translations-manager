// API client for collaboration features

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  masterLanguage: string;
  targetLanguages: string[];
  masterData: Record<string, unknown>;
  translations: Record<string, Record<string, unknown>>;
  ownerId: string;
  owner: Pick<User, 'id' | 'name' | 'email'>;
  members?: ProjectMember[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  role: 'editor' | 'viewer';
  userId: string;
  user: Pick<User, 'id' | 'name' | 'email'>;
  projectId: string;
  joinedAt: string;
}

export interface InviteCode {
  id: string;
  code: string;
  role: 'editor' | 'viewer';
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  createdAt: string;
  createdBy: Pick<User, 'id' | 'name' | 'email'>;
}

// Get user ID from localStorage (simple auth for now)
function getUserId(): string {
  if (typeof window === 'undefined') return '';
  
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('userId', userId);
  }
  return userId;
}

function getUserEmail(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userEmail');
}

function getUserName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('userName');
}

export function setUserInfo(email: string, name?: string) {
  localStorage.setItem('userEmail', email);
  if (name) {
    localStorage.setItem('userName', name);
  }
}

function getHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
    'x-user-email': getUserEmail() || '',
    'x-user-name': getUserName() || '',
  };
}

// User API
export async function getOrCreateUser(): Promise<User> {
  const res = await fetch('/api/users/me', { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to get user');
  return res.json();
}

export async function updateUser(data: { name?: string; email?: string }): Promise<User> {
  // Also update localStorage
  if (data.email) {
    localStorage.setItem('userEmail', data.email);
  }
  if (data.name) {
    localStorage.setItem('userName', data.name);
  }
  
  const res = await fetch('/api/users/me', {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update user');
  return res.json();
}

// Projects API
export async function listProjects(): Promise<Project[]> {
  const res = await fetch('/api/projects', { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to list projects');
  return res.json();
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to get project');
  return res.json();
}

export async function createProject(data: {
  name: string;
  masterLanguage?: string;
  targetLanguages?: string[];
  masterData?: Record<string, unknown>;
  translations?: Record<string, Record<string, unknown>>;
}): Promise<Project> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function updateProject(id: string, data: {
  name?: string;
  masterLanguage?: string;
  targetLanguages?: string[];
  masterData?: Record<string, unknown>;
  translations?: Record<string, Record<string, unknown>>;
}): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update project');
  return res.json();
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete project');
}

// Invite Codes API
export async function listInviteCodes(projectId: string): Promise<InviteCode[]> {
  const res = await fetch(`/api/projects/${projectId}/invites`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to list invite codes');
  return res.json();
}

export async function createInviteCode(projectId: string, data?: {
  role?: 'editor' | 'viewer';
  maxUses?: number;
  expiresInDays?: number;
}): Promise<InviteCode> {
  const res = await fetch(`/api/projects/${projectId}/invites`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data || {}),
  });
  if (!res.ok) throw new Error('Failed to create invite code');
  return res.json();
}

export async function deleteInviteCode(projectId: string, inviteId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}/invites/${inviteId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Failed to delete invite code');
}

// Join API
export async function joinProject(code: string): Promise<{ success: boolean; project: Project; role: string }> {
  const res = await fetch('/api/join', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ code }),
  });
  
  const data = await res.json();
  
  if (!res.ok) {
    throw new Error(data.error || 'Failed to join project');
  }
  
  return data;
}

// Check if user has set up their profile
export function hasUserProfile(): boolean {
  return !!getUserEmail();
}

// Get current user ID (for checking ownership)
export function getCurrentUserId(): string {
  return getUserId();
}
