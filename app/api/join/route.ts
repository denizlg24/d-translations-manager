import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/join - Join a project using an invite code
export async function POST(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: 'Invite code is required' }, { status: 400 });
    }

    // Find the invite code
    const invite = await prisma.inviteCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        project: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    // Check if expired
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 });
    }

    // Check if max uses reached
    if (invite.maxUses && invite.uses >= invite.maxUses) {
      return NextResponse.json({ error: 'Invite code has reached maximum uses' }, { status: 400 });
    }

    // Check if user is already the owner
    if (invite.project.ownerId === userId) {
      return NextResponse.json({ error: 'You already own this project' }, { status: 400 });
    }

    // Check if user is already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId: invite.projectId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json({ error: 'You are already a member of this project' }, { status: 400 });
    }

    // Add user as member and increment uses in a transaction
    const [member] = await prisma.$transaction([
      prisma.projectMember.create({
        data: {
          userId,
          projectId: invite.projectId,
          role: invite.role,
        },
        include: {
          project: {
            include: {
              owner: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.inviteCode.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      project: member.project,
      role: member.role,
    });
  } catch (error) {
    console.error('Failed to join project:', error);
    return NextResponse.json({ error: 'Failed to join project' }, { status: 500 });
  }
}
