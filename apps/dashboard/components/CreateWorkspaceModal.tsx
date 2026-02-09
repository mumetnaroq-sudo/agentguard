'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

interface CreateWorkspaceModalProps {
  onWorkspaceCreated?: () => void;
}

export default function CreateWorkspaceModal({ onWorkspaceCreated }: CreateWorkspaceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  function closeModal() {
    setIsOpen(false);
    setWorkspaceName('');
    setError('');
  }

  function openModal() {
    setIsOpen(true);
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    
    if (!workspaceName.trim()) {
      setError('Workspace name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: workspaceName.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create workspace');
      }

      closeModal();
      
      // Refresh the page or call callback
      if (onWorkspaceCreated) {
        onWorkspaceCreated();
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
      >
        Create Workspace
      </button>

      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 p-6 text-left align-middle shadow-xl transition-all border border-gray-800">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-white mb-4"
                  >
                    Create New Workspace
                  </Dialog.Title>

                  <form onSubmit={handleCreateWorkspace} className="space-y-4">
                    <div>
                      <label htmlFor="workspace-name" className="block text-sm font-medium text-gray-300 mb-2">
                        Workspace Name
                      </label>
                      <input
                        id="workspace-name"
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter workspace name"
                        disabled={isLoading}
                        autoFocus
                      />
                    </div>

                    {error && (
                      <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
                        {error}
                      </div>
                    )}

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                        onClick={closeModal}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Creating...' : 'Create Workspace'}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}