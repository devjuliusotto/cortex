export interface Agent {
  id: string;
  name: string;
  description: string;
  officialUrl: string;
  installCommandWindows: string;
  installCommandMac: string;
  installCommandLinux: string;
  detectCommandWindows: string;
  detectCommandUnix: string;
  runCommand: string;
  requiresLogin: boolean;
  loginHint?: string;
  postInstallTutorial?: string;
  tags: string[];
  needsVerification?: boolean;
}

export const agentsCatalog: Agent[] = [
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    description: "The official Google Gemini CLI for developers. AI-powered terminal assistant with full codebase context.",
    officialUrl: "https://geminicli.com",
    installCommandWindows: "npm install -g @google/gemini-cli",
    installCommandMac: "npm install -g @google/gemini-cli",
    installCommandLinux: "npm install -g @google/gemini-cli",
    detectCommandWindows: "where gemini",
    detectCommandUnix: "which gemini",
    runCommand: "gemini",
    requiresLogin: true,
    loginHint: "Run 'gemini' and follow the OAuth flow in your browser.",
    postInstallTutorial: "Use '/init' to bootstrap your project and '/help' to see available commands.",
    tags: ["google", "gemini", "codebase-aware", "mcp"],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    description: "Agentic AI coding assistant from Anthropic that operates directly in your terminal.",
    officialUrl: "https://code.claude.com",
    installCommandWindows: "irm https://claude.ai/install.ps1 | iex",
    installCommandMac: "curl -fsSL https://claude.ai/install.sh | bash",
    installCommandLinux: "curl -fsSL https://claude.ai/install.sh | bash",
    detectCommandWindows: "where claude",
    detectCommandUnix: "which claude",
    runCommand: "claude",
    requiresLogin: true,
    loginHint: "Requires a Claude Pro/Max subscription or Anthropic Console account.",
    postInstallTutorial: "Run 'claude' to start. Use 'claude doctor' to check your environment.",
    tags: ["anthropic", "claude", "agentic", "terminal-tui"],
  },
  {
    id: "aider",
    name: "Aider",
    description: "Open source AI pair programming tool that edits code directly in your local git repository.",
    officialUrl: "https://aider.chat",
    installCommandWindows: "pip install aider-chat",
    installCommandMac: "pip install aider-chat",
    installCommandLinux: "pip install aider-chat",
    detectCommandWindows: "where aider",
    detectCommandUnix: "which aider",
    runCommand: "aider",
    requiresLogin: false,
    loginHint: "Requires an API key for your chosen provider (OpenAI, Anthropic, etc.) in your environment variables.",
    postInstallTutorial: "Set OPENAI_API_KEY or ANTHROPIC_API_KEY and run 'aider' in your git repo.",
    tags: ["open-source", "git-integrated", "multi-model"],
  },
  {
    id: "codex-cli",
    name: "Codex CLI",
    description: "Lightweight coding agent from OpenAI that runs locally and uses AGENTS.md for context.",
    officialUrl: "https://openai.com/codex",
    installCommandWindows: "npm install -g @openai/codex",
    installCommandMac: "npm install -g @openai/codex",
    installCommandLinux: "npm install -g @openai/codex",
    detectCommandWindows: "where codex",
    detectCommandUnix: "which codex",
    runCommand: "codex",
    requiresLogin: true,
    needsVerification: true,
    loginHint: "Uses ChatGPT OAuth or OPENAI_API_KEY.",
    tags: ["openai", "codex", "minimalist"],
  },
  {
    id: "opencode",
    name: "OpenCode",
    description: "Terminal-first AI coding agent with a rich TUI and support for multiple LLM providers.",
    officialUrl: "https://opencode.ai",
    installCommandWindows: "npm install -g opencode-ai",
    installCommandMac: "curl -fsSL https://opencode.ai/install | bash",
    installCommandLinux: "curl -fsSL https://opencode.ai/install | bash",
    detectCommandWindows: "where opencode",
    detectCommandUnix: "which opencode",
    runCommand: "opencode",
    requiresLogin: true,
    loginHint: "Run 'opencode auth login' to connect your preferred LLM provider.",
    tags: ["open-source", "tui", "multi-provider"],
  },
  {
    id: "continue-cli",
    name: "Continue CLI",
    description: "The command-line companion to Continue, allowing you to use your IDE's AI configuration in the terminal.",
    officialUrl: "https://continue.dev",
    installCommandWindows: "npm i -g @continuedev/cli",
    installCommandMac: "npm i -g @continuedev/cli",
    installCommandLinux: "npm i -g @continuedev/cli",
    detectCommandWindows: "where cn",
    detectCommandUnix: "which cn",
    runCommand: "cn",
    requiresLogin: true,
    loginHint: "Run 'cn login' to authenticate with your Continue account.",
    tags: ["continue", "open-source", "context-aware"],
  },
  {
    id: "gh-copilot-cli",
    name: "GitHub Copilot CLI",
    description: "GitHub Copilot extension for the command line, providing suggestions for shell commands.",
    officialUrl: "https://github.com/features/copilot",
    installCommandWindows: "gh extension install github/gh-copilot",
    installCommandMac: "gh extension install github/gh-copilot",
    installCommandLinux: "gh extension install github/gh-copilot",
    detectCommandWindows: "gh extension list | findstr copilot",
    detectCommandUnix: "gh extension list | grep copilot",
    runCommand: "gh copilot suggest",
    requiresLogin: true,
    loginHint: "Requires GitHub CLI (gh) and an active Copilot subscription.",
    tags: ["github", "copilot", "shell-assistant"],
  },
  {
    id: "shell-gpt",
    name: "Shell GPT",
    description: "A command-line productivity tool powered by AI to generate shell commands, code snippets, and more.",
    officialUrl: "https://github.com/jtortorelli/shell-gpt",
    installCommandWindows: "pip install shell-gpt",
    installCommandMac: "pip install shell-gpt",
    installCommandLinux: "pip install shell-gpt",
    detectCommandWindows: "where sgpt",
    detectCommandUnix: "which sgpt",
    runCommand: "sgpt",
    requiresLogin: false,
    loginHint: "Requires an OPENAI_API_KEY environment variable.",
    tags: ["python", "productivity", "shell-integration"],
  }
];
