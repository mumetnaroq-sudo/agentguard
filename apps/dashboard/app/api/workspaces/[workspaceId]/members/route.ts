import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has access to this workspace
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: dbUser.id,
        },
      },
    });

    if (!workspaceMember || !workspaceMember.joinedAt) {
      return NextResponse.json({ error: 'You do not have access to this workspace' }, { status: 403 });
    }

    // Get all workspace members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching workspace members:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}