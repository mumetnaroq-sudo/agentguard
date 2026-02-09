'use client';

import { useState } from 'react';
import InviteMemberModal from './InviteMemberModal';

interface Workspace {
  id: string;
  name: string;
  tier: string;
  ownerId: string;
  owner: {
    id: string;
    email: string;
  };
  _count: {
    members: number;
  };
}

interface WorkspaceCardClientProps {
  workspace: Workspace;
  currentUserId: string;
}

export default function WorkspaceCardClient({ workspace, currentUserId }: WorkspaceCardClientProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const isOwner = workspace.ownerId === currentUserId;
  const memberCount = workspace._count.members;

  return (
    <>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
              {workspace.name}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {isOwner ? "Owner" : "Member"}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs rounded-full ${
              workspace.tier === 'free' ? 'bg-gray-800 text-gray-300' :
              workspace.tier === 'pro' ? 'bg-blue-900 text-blue-300' :
              'bg-purple-900 text-purple-300'
            }`}>
              {workspace.tier.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center text-sm text-gray-400">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </div>

          <div className="flex items-center text-sm text-gray-400">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            {workspace.owner.email}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800">
          <button 
            onClick={() => setIsInviteModalOpen(true)}
            className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Manage Workspace →
          </button>
        </div>
      </div>

      <InviteMemberModal
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onMemberInvited={() => {
          // Refresh the page to update member count
          window.location.reload();
        }}
      />
    </>
  );
}