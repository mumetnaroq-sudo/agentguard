# AgentGuard 🔒

> Security assessment and certification for AI agents

AgentGuard (formerly ASACS) is a comprehensive security scanning tool designed specifically for AI agents. It helps developers identify vulnerabilities, generate compliance reports, and ensure their agents meet security standards.

## Features

- 🔍 **YARA Scanner** - Detect malicious patterns in agent code
- 📦 **Dependency Audit** - Identify vulnerable dependencies
- 📄 **SBOM Generation** - Create Software Bill of Materials for compliance
- 🔐 **Code Signing Verification** - Validate code integrity
- ⚡ **GitHub Action** - Integrate with CI/CD pipelines
- 📊 **Web Dashboard** - Visual reports and team management

## Quick Start

### Installation

```bash
npm install -g agentguard
```

### Scan an Agent

```bash
agentguard scan ./my-agent
```

### Generate SBOM

```bash
agentguard sbom ./my-agent --output sbom.json
```

## GitHub Action

Add to your `.github/workflows/security.yml`:

```yaml
name: Security Scan
on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: mumetnaroq/agentguard@v1
        with:
          path: './'
          fail-on-critical: true
```

## SaaS Dashboard

Visit [agentguard.vercel.app](https://agentguard.vercel.app) for:
- Web-based security scanning
- Team workspaces
- Compliance reporting
- Historical analysis
- Custom rule management

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| **Open Source** | Free | CLI, GitHub Action, basic rules |
| **Pro** | $29/mo | Web dashboard, advanced rules, reports |
| **Team** | $99/mo | Team workspaces, SSO, priority support |
| **Enterprise** | $299+/mo | Custom rules, on-premise, compliance |

## Documentation

- [Getting Started](docs/getting-started.md)
- [YARA Rules](docs/yara-rules.md)
- [CI/CD Integration](docs/cicd.md)
- [API Reference](docs/api.md)

## Security

AgentGuard is built with security as the primary concern. All scanning happens locally by default - no code is sent to external servers unless you explicitly use the SaaS dashboard.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT © Jeremiah (Noah)

---

Built with ❤️ for the agent-native future.
