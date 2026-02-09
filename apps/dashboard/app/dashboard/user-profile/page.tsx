import { UserProfile } from "@clerk/nextjs";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Profile | AgentGuard",
  description: "Manage your AgentGuard account settings",
};

export default function UserProfilePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Account Settings</h1>
        <UserProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-gray-900 border border-gray-800 shadow-xl",
              navbar: "bg-gray-900 border-b border-gray-800",
              navbarButton: "text-gray-300 hover:text-white",
              active: "text-blue-400",
              headerTitle: "text-white",
              headerSubtitle: "text-gray-400",
              profileSectionTitle: "text-white",
              profileSectionContent: "text-gray-300",
              formFieldLabel: "text-gray-300",
              formFieldInput: "bg-gray-800 border-gray-700 text-white",
              formButtonPrimary: "bg-blue-500 hover:bg-blue-600",
              formButtonReset: "text-gray-300 hover:text-white",
              identityPreviewText: "text-gray-300",
              identityPreviewEditButton: "text-blue-400 hover:text-blue-300",
            },
          }}
        />
      </div>
    </div>
  );
}
