import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: { workspaceId: string } }
) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId } = params;
    const { email, role } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!role || !['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Valid role is required (admin or member)' }, { status: 400 });
    }

    // Get user from database
    const dbUser = await prisma.user.findUnique({
      where: { clerkId: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has permission to invite members (owner or admin)
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: dbUser.id,
        },
      },
    });

    if (!workspaceMember || !['owner', 'admin'].includes(workspaceMember.role)) {
      return NextResponse.json({ error: 'You do not have permission to invite members' }, { status: 403 });
    }

    // Check if workspace exists
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if the user being invited exists
    const invitedUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!invitedUser) {
      return NextResponse.json({ error: 'User with this email not found' }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: invitedUser.id,
        },
      },
    });

    if (existingMember) {
      if (existingMember.joinedAt) {
        return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'Invitation has already been sent to this user' }, { status: 400 });
      }
    }

    // Create workspace member (invitation)
    const workspaceMemberInvitation = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: invitedUser.id,
        role,
        invitedAt: new Date(),
      },
    });

    // TODO: Send email notification
    // This would typically integrate with an email service
    // For now, we'll just return success

    return NextResponse.json({ 
      message: 'Invitation sent successfully',
      invitation: workspaceMemberInvitation 
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}