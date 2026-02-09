"use client";

import { UserButton } from "@clerk/nextjs";
import { Shield, Bell, Search } from "lucide-react";
import Link from "next/link";

interface DashboardHeaderProps {
  user: {
    firstName: string | null;
    lastName: string | null;
    username: string | null;
    imageUrl: string;
    primaryEmailAddress?: {
      emailAddress: string;
    } | null;
  };
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AgentGuard</span>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-lg mx-8 hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search agents, scans, reports..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            
            <div className="flex items-center space-x-3">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-white">
                  {user.firstName || user.username || "User"}
                </p>
                <p className="text-xs text-gray-400">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9 rounded-lg",
                  },
                }}
                userProfileUrl="/dashboard/user-profile"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
