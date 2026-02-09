import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Metadata } from "next";
import DashboardHeader from "@/components/auth/DashboardHeader";
import DashboardSidebar from "@/components/auth/DashboardSidebar";

export const metadata: Metadata = {
  title: "Dashboard | AgentGuard",
  description: "Security assessment and certification dashboard",
};

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <DashboardHeader user={user} />
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">
                Welcome back, {user.firstName || user.username || "User"}
              </h1>
              <p className="text-gray-400">
                Here&apos;s what&apos;s happening with your security scans
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <StatCard
                title="Total Scans"
                value="24"
                change="+12%"
                trend="up"
              />
              <StatCard
                title="Vulnerabilities Found"
                value="7"
                change="-3"
                trend="down"
              />
              <StatCard
                title="Secure Agents"
                value="18"
                change="+5"
                trend="up"
              />
              <StatCard
                title="Compliance Score"
                value="94%"
                change="+2%"
                trend="up"
              />
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Recent Activity
              </h2>
              <div className="space-y-4">
                <ActivityItem
                  title="Security scan completed"
                  description="my-agent-project passed all checks"
                  time="2 hours ago"
                  status="success"
                />
                <ActivityItem
                  title="Vulnerability detected"
                  description="High severity issue in dependency"
                  time="5 hours ago"
                  status="warning"
                />
                <ActivityItem
                  title="New agent registered"
                  description="customer-support-bot added to workspace"
                  time="1 day ago"
                  status="info"
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  change,
  trend,
}: {
  title: string;
  value: string;
  change: string;
  trend: "up" | "down";
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-2">{title}</h3>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-bold text-white">{value}</span>
        <span
          className={`text-sm font-medium ${
            trend === "up" ? "text-green-400" : "text-red-400"
          }`}
        >
          {change}
        </span>
      </div>
    </div>
  );
}

function ActivityItem({
  title,
  description,
  time,
  status,
}: {
  title: string;
  description: string;
  time: string;
  status: "success" | "warning" | "info";
}) {
  const statusColors = {
    success: "bg-green-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };

  return (
    <div className="flex items-start space-x-4 p-4 bg-gray-800/50 rounded-lg">
      <div className={`w-2 h-2 rounded-full mt-2 ${statusColors[status]}`} />
      <div className="flex-1">
        <h4 className="text-white font-medium">{title}</h4>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
      <span className="text-gray-500 text-sm">{time}</span>
    </div>
  );
}
