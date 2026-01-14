import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/users/me - Get current user or create if doesn't exist
export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const userEmail = request.headers.get('x-user-email');
  const userName = request.headers.get('x-user-name');
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 });
  }

  try {
    // Try to find existing user
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // If not found, try by email
    if (!user && userEmail) {
      user = await prisma.user.findUnique({
        where: { email: userEmail },
      });
    }

    // Create user if doesn't exist
    if (!user && userEmail) {
      user = await prisma.user.create({
        data: {
          id: userId,
          email: userEmail,
          name: userName || null,
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found and cannot create without email' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to get/create user:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

// PUT /api/users/me - Update current user
export async function PUT(request: NextRequest) {
  const userId = request.headers.get('x-user-id');
  const userEmail = request.headers.get('x-user-email');
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email } = body;

    // Use upsert to create user if doesn't exist
    const user = await prisma.user.upsert({
      where: { id: userId },
      update: { 
        name: name || undefined,
        email: email || undefined,
      },
      create: {
        id: userId,
        email: email || userEmail || '',
        name: name || null,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
