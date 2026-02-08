# AgentGuard Deployment Checklist

## Step 1: Create GitHub Repository
- [ ] Go to github.com/new
- [ ] Name: agentguard
- [ ] Make public
- [ ] Add README, .gitignore (Python), LICENSE (MIT)

## Step 2: Push Code
```bash
cd /Users/mumetnaroq/.openclaw/workspace/agentguard
git init
git add .
git commit -m "Initial commit: AgentGuard security scanner"
git remote add origin https://github.com/YOUR_USERNAME/agentguard.git
git push -u origin main
```

## Step 3: Configure GitHub Actions
- [ ] Go to repo → Settings → Actions → General
- [ ] Allow all actions
- [ ] Go to Actions tab → New workflow
- [ ] Copy .github/workflows/agentguard.yml content

## Step 4: Deploy to Vercel
- [ ] Go to vercel.com/new
- [ ] Import GitHub repo
- [ ] Framework: Other
- [ ] Build command: (none, static files)
- [ ] Deploy

## Step 5: Verify
- [ ] https://agentguard.vercel.app loads
- [ ] GitHub Actions runs successfully
- [ ] Dashboard shows data
