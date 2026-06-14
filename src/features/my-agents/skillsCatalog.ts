export interface SkillPath {
  path: string;
  type: "global" | "local";
  description: string;
}

export interface Extension {
  id: string;
  name: string;
  provider: string;
  description: string;
  githubUrl: string;
  installCommand: string;
  category: "MCP" | "Skill" | "Hook" | "Command" | "Context";
}

export const skillPaths: SkillPath[] = [
  {
    path: "~/.gemini/skills/",
    type: "global",
    description: "Global skills available across all projects for the current user.",
  },
  {
    path: "~/.agents/skills/",
    type: "global",
    description: "Alternative global path for cross-agent compatibility.",
  },
  {
    path: ".gemini/skills/",
    type: "local",
    description: "Project-specific skills, often committed to version control.",
  },
  {
    path: ".agents/skills/",
    type: "local",
    description: "Alternative local path for project-specific agent instructions.",
  }
];

export const skillsExplanation = `
Gemini CLI Skills are specialized procedural guidance and tools for specific tasks. 
They allow the AI to follow complex workflows, use specific architectural patterns, 
or leverage external scripts. Skills can be stored globally for personal use or 
locally within a project to share with a team.
`;

export const extensionsCatalog: Extension[] = [
  {
    id: "mcp-toolbox",
    name: "MCP Toolbox for Databases",
    provider: "@googleapis",
    description: "Connects the CLI to 30+ different data sources including BigQuery, Spanner, and Cloud SQL.",
    githubUrl: "https://github.com/googleapis/mcp-toolbox",
    installCommand: "gemini extensions install googleapis/mcp-toolbox",
    category: "MCP",
  },
  {
    id: "caveman",
    name: "Caveman",
    provider: "@JuliusBrussee",
    description: "A compressed communication mode that reduces token usage by ~75% while maintaining context.",
    githubUrl: "https://github.com/JuliusBrussee/caveman",
    installCommand: "gemini extensions install JuliusBrussee/caveman",
    category: "Context",
  },
  {
    id: "gemini-security",
    name: "Gemini Security",
    provider: "@gemini-cli-extensions",
    description: "Automated security analysis that finds vulnerabilities in code changes and PRs.",
    githubUrl: "https://github.com/gemini-cli-extensions/security",
    installCommand: "gemini extensions install gemini-cli-extensions/security",
    category: "Skill",
  },
  {
    id: "worktrunk",
    name: "Worktrunk",
    provider: "@max-sixty",
    description: "Git worktree management optimized for parallel AI agent workflows.",
    githubUrl: "https://github.com/max-sixty/worktrunk",
    installCommand: "gemini extensions install max-sixty/worktrunk",
    category: "Command",
  },
  {
    id: "exa-mcp",
    name: "Exa MCP Server",
    provider: "@exa-labs",
    description: "Enables real-time web search and crawling for up-to-date technical documentation.",
    githubUrl: "https://github.com/exa-labs/exa-mcp-server",
    installCommand: "gemini extensions install exa-labs/exa-mcp-server",
    category: "MCP",
  }
];

export const extensionInstallationGuide = {
  command: "gemini extensions install <github-url>",
  example: "gemini extensions install username/repo-name",
  description: "Install extensions directly from GitHub to enhance Gemini CLI with new capabilities, MCP servers, or custom commands."
};
