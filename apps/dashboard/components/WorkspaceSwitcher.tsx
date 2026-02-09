'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ChevronDown, Building2, Plus } from 'lucide-react';
import Link from 'next/link';

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

interface WorkspaceSwitcherProps {
  currentUserId: string;
}

export default function WorkspaceSwitcher({ currentUserId }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    // Extract workspace ID from URL if present
    const workspaceId = extractWorkspaceIdFromPath(pathname);
    if (workspaceId && workspaces.length > 0) {
      const workspace = workspaces.find(w => w.id === workspaceId);
      if (workspace) {
        setCurrentWorkspace(workspace);
      }
    } else if (workspaces.length > 0 && !currentWorkspace) {
      // Set first workspace as current if none selected
      setCurrentWorkspace(workspaces[0]);
    }
  }, [workspaces, pathname]);

  function extractWorkspaceIdFromPath(path: string): string | null {
    // Look for workspace ID in URL patterns like /dashboard/ws_[id]/...
    const match = path.match(/\/ws_([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  }

  async function fetchWorkspaces() {
    try {
      const response = await fetch('/api/workspaces');
      if (!response.ok) throw new Error('Failed to fetch workspaces');
      
      const data = await response.json();
      setWorkspaces(data.workspaces || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleWorkspaceSelect(workspace: Workspace) {
    setCurrentWorkspace(workspace);
    setIsOpen(false);
    
    // Navigate to workspace-specific dashboard
    // You can customize this URL pattern based on your routing needs
    const workspacePath = `/dashboard/ws_${workspace.id}`;
    
    // If we're already on a workspace-specific page, stay there
    // Otherwise go to the main dashboard for this workspace
    if (pathname.includes('/dashboard/') && !pathname.includes('/workspaces')) {
      router.push(workspacePath + pathname.replace(/^\/dashboard/, ''));
    } else {
      router.push(workspacePath);
    }
  }

  function getWorkspaceInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  if (isLoading) {
    return (
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="h-4 bg-gray-700 rounded w-32 animate-pulse"></div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="p-4 border-b border-gray-800">
        <Link
          href="/dashboard/workspaces"
          className="flex items-center justify-between text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-sm">No workspaces</span>
          <Plus className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="relative border-b border-gray-800">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            {currentWorkspace ? (
              <span className="text-white text-sm font-medium">
                {getWorkspaceInitials(currentWorkspace.name)}
              </span>
            ) : (
              <Building2 className="w-4 h-4 text-white" />
            )}
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white">
              {currentWorkspace?.name || 'Select Workspace'}
            </div>
            <div className="text-xs text-gray-400">
              {currentWorkspace?.tier.toUpperCase()}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-gray-900 border border-gray-800 rounded-lg shadow-lg z-50 mt-1">
          <div className="p-2">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceSelect(workspace)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentWorkspace?.id === workspace.id
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{workspace.name}</div>
                    <div className="text-xs text-gray-500">
                      {workspace._count.members} member{workspace._count.members !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {currentWorkspace?.id === workspace.id && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              </button>
            ))}
            
            <div className="border-t border-gray-800 mt-2 pt-2">
              <Link
                href="/dashboard/workspaces"
                className="flex items-center space-x-2 p-3 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Plus className="w-4 h-4" />
                <span>Create Workspace</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}