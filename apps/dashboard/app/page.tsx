import Link from "next/link";
import { Shield, CheckCircle, ArrowRight, Lock, Zap, Users } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Navigation */}
      <nav className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">AgentGuard</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/sign-in"
                className="text-gray-300 hover:text-white font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Secure Your AI Agents
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            AgentGuard provides comprehensive security scanning, vulnerability detection,
            and compliance certification for AI agents. Protect your systems before deployment.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Link
              href="/sign-up"
              className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors inline-flex items-center"
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              href="/sign-in"
              className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Why Choose AgentGuard?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={Lock}
              title="Security First"
              description="Advanced YARA scanning and dependency auditing to catch vulnerabilities before they reach production."
            />
            <FeatureCard
              icon={Zap}
              title="Fast & Efficient"
              description="Automated scanning integrated into your CI/CD pipeline with instant feedback on security issues."
            />
            <FeatureCard
              icon={Users}
              title="Team Collaboration"
              description="Shared workspaces, role-based access, and detailed reporting for your entire team."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Simple, Transparent Pricing
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <PricingCard
              name="Open Source"
              price="Free"
              description="Perfect for individual developers"
              features={[
                "CLI tool access",
                "Basic YARA rules",
                "GitHub Action",
                "Community support",
              ]}
              cta="Get Started"
              href="/sign-up"
              highlighted={false}
            />
            <PricingCard
              name="Pro"
              price="$29"
              period="/month"
              description="For professional developers"
              features={[
                "Everything in Open Source",
                "Web dashboard access",
                "Advanced rules",
                "Detailed reports",
                "Priority support",
              ]}
              cta="Start Free Trial"
              href="/sign-up"
              highlighted={true}
            />
            <PricingCard
              name="Team"
              price="$99"
              period="/month"
              description="For teams and organizations"
              features={[
                "Everything in Pro",
                "Team workspaces",
                "SSO integration",
                "Custom rules",
                "Dedicated support",
              ]}
              cta="Contact Sales"
              href="/sign-up"
              highlighted={false}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Secure Your Agents?
          </h2>
          <p className="text-gray-400 mb-8">
            Join thousands of developers who trust AgentGuard for their AI agent security.
          </p>
          <Link
            href="/sign-up"
            className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg transition-colors inline-flex items-center"
          >
            Create Free Account
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-3 mb-4 md:mb-0">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-medium">AgentGuard</span>
          </div>
          <p className="text-gray-500 text-sm">
            © 2026 AgentGuard. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  href,
  highlighted,
}: {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-6 ${
        highlighted
          ? "bg-blue-500/10 border-2 border-blue-500"
          : "bg-gray-900 border border-gray-800"
      }`}
    >
      <h3 className="text-xl font-semibold text-white mb-2">{name}</h3>
      <div className="flex items-baseline mb-2">
        <span className="text-4xl font-bold text-white">{price}</span>
        {period && <span className="text-gray-400 ml-1">{period}</span>}
      </div>
      <p className="text-gray-400 mb-6">{description}</p>
      <ul className="space-y-3 mb-6">
        {features.map((feature) => (
          <li key={feature} className="flex items-center text-gray-300">
            <CheckCircle className="w-5 h-5 text-green-400 mr-3 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`block text-center py-3 rounded-lg font-medium transition-colors ${
          highlighted
            ? "bg-blue-500 hover:bg-blue-600 text-white"
            : "bg-gray-800 hover:bg-gray-700 text-white"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}
