'use client';

import { useState, useEffect } from 'react';
import { Users, Mail, Shield, UserPlus, MoreVertical, Trash2 } from 'lucide-react';
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

interface TeamMember {
  id: string;
  role: string;
  invitedAt: string;
  joinedAt: string | null;
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
}

interface TeamManagementClientProps {
  workspaces: Workspace[];
  currentUserId: string;
}

export default function TeamManagementClient({ workspaces, currentUserId }: TeamManagementClientProps) {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspace) {
      setSelectedWorkspace(workspaces[0]);
    }
  }, [workspaces, selectedWorkspace]);

  useEffect(() => {
    if (selectedWorkspace) {
      fetchMembers();
    }
  }, [selectedWorkspace]);

  async function fetchMembers() {
    if (!selectedWorkspace) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/members`);
      if (!response.ok) throw new Error('Failed to fetch members');
      
      const data = await response.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }

  function getRoleIcon(role: string) {
    switch (role) {
      case 'owner':
        return <Shield className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-400" />;
    }
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'owner':
        return 'bg-yellow-900/20 text-yellow-400 border border-yellow-800';
      case 'admin':
        return 'bg-blue-900/20 text-blue-400 border border-blue-800';
      default:
        return 'bg-gray-900/20 text-gray-400 border border-gray-800';
    }
  }

  const canInvite = selectedWorkspace && 
    (selectedWorkspace.ownerId === currentUserId || 
     members.some(m => m.user.id === currentUserId && m.role === 'admin'));

  if (workspaces.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">
          No workspaces available
        </h3>
        <p className="text-gray-400 mb-4">
          Create a workspace to start inviting team members
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Selector */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Select Workspace</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => setSelectedWorkspace(workspace)}
              className={`p-4 rounded-lg border transition-all ${
                selectedWorkspace?.id === workspace.id
                  ? 'bg-blue-900/20 border-blue-500 text-blue-400'
                  : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{workspace.name}</h3>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  workspace.tier === 'free' ? 'bg-gray-700 text-gray-300' :
                  workspace.tier === 'pro' ? 'bg-blue-700 text-blue-200' :
                  'bg-purple-700 text-purple-200'
                }`}>
                  {workspace.tier.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-400">
                {workspace._count.members} member{workspace._count.members !== 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Team Members */}
      {selectedWorkspace && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">
              Team Members - {selectedWorkspace.name}
            </h2>
            {canInvite && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite Member</span>
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-gray-400 mt-2">Loading team members...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No team members</h3>
              <p className="text-gray-400">
                {canInvite 
                  ? "Invite your first team member to get started"
                  : "Only workspace owners and admins can invite members"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {member.user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="font-medium text-white">{member.user.email}</p>
                        <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(member.role)}`}>
                          {member.role.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {member.joinedAt 
                          ? `Joined ${new Date(member.joinedAt).toLocaleDateString()}`
                          : `Invited ${new Date(member.invitedAt).toLocaleDateString()}`
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getRoleIcon(member.role)}
                    {selectedWorkspace.ownerId === currentUserId && member.user.id !== currentUserId && (
                      <button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {selectedWorkspace && (
        <InviteMemberModal
          workspaceId={selectedWorkspace.id}
          workspaceName={selectedWorkspace.name}
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          onMemberInvited={() => {
            fetchMembers();
          }}
        />
      )}
    </div>
  );
}