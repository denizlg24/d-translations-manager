import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string; inviteId: string }>;
}

// DELETE /api/projects/[id]/invites/[inviteId] - Delete an invite code
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: projectId, inviteId } = await params;
  const userId = request.headers.get('x-user-id');
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 });
  }

  try {
    // Only owner can delete invite codes
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: userId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found or not owner' }, { status: 404 });
    }

    await prisma.inviteCode.delete({
      where: { id: inviteId, projectId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete invite:', error);
    return NextResponse.json({ error: 'Failed to delete invite' }, { status: 500 });
  }
}
