import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import DashboardHeader from "@/components/auth/DashboardHeader";
import DashboardSidebar from "@/components/auth/DashboardSidebar";
import TeamManagementClient from "@/components/TeamManagementClient";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Team Management | AgentGuard",
  description: "Manage your team members and invitations",
};

async function getUserWorkspaces(userId: string) {
  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId: userId,
              joinedAt: {
                not: null,
              },
            },
          },
        },
      ],
    },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return workspaces;
}

export default async function TeamPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Get user from database
  const dbUser = await prisma.user.findUnique({
    where: { clerkId: user.id },
  });

  if (!dbUser) {
    redirect("/sign-in");
  }

  const workspaces = await getUserWorkspaces(dbUser.id);

  return (
    <div className="min-h-screen bg-gray-950">
      <DashboardHeader user={user} />
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Team Management
              </h1>
              <p className="text-gray-400">
                Manage your team members and workspace invitations
              </p>
            </div>

            <TeamManagementClient 
              workspaces={workspaces} 
              currentUserId={dbUser.id} 
            />
          </div>
        </main>
      </div>
    </div>
  );
}