import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import DashboardHeader from "@/components/auth/DashboardHeader";
import DashboardSidebar from "@/components/auth/DashboardSidebar";
import CreateWorkspaceModal from "@/components/CreateWorkspaceModal";
import WorkspaceCardClient from "@/components/WorkspaceCardClient";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Workspaces | AgentGuard",
  description: "Manage your workspaces and team members",
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

export default async function WorkspacesPage() {
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
            <div className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Your Workspaces
                </h1>
                <p className="text-gray-400">
                  Manage your workspaces and collaborate with your team
                </p>
              </div>
              <CreateWorkspaceModal />
            </div>

            {/* Workspaces Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workspaces.map((workspace) => (
                <WorkspaceCardClient
                  key={workspace.id}
                  workspace={workspace}
                  currentUserId={dbUser.id}
                />
              ))}
            </div>

            {workspaces.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  No workspaces yet
                </h3>
                <p className="text-gray-400 mb-4">
                  Create your first workspace to start managing your AI agents
                </p>
                <CreateWorkspaceModal />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}