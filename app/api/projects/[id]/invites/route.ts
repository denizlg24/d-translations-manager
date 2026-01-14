import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Generate a random invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous characters
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/invites - List invite codes for a project
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 });
  }

  try {
    // Only owner can view invite codes
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or not owner' }, { status: 404 });
    }

    const invites = await prisma.inviteCode.findMany({
      where: { projectId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(invites);
  } catch (error) {
    console.error('Failed to fetch invites:', error);
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}

// POST /api/projects/[id]/invites - Create a new invite code
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params;
  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 });
  }

  try {
    // Only owner can create invite codes
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or not owner' }, { status: 404 });
    }

    const body = await request.json();
    const { role = 'editor', maxUses, expiresInDays } = body;

    // Generate unique code
    let code: string;
    let attempts = 0;
    do {
      code = generateInviteCode();
      const existing = await prisma.inviteCode.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });
    }

    const invite = await prisma.inviteCode.create({
      data: {
        code,
        role,
        maxUses: maxUses || null,
        expiresAt: expiresInDays 
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
        projectId,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    console.error('Failed to create invite:', error);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}
