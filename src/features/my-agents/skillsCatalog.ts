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

export interface CuratedSkill {
  id: string;
  name: string;
  repository: string;
  description: string;
  category: "Discovery" | "Frontend" | "Testing" | "Code Quality" | "Docs" | "DevOps" | "Databases" | "Marketing" | "Workflow";
  installs: string;
  tags: string[];
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

export const curatedSkillCategories = [
  "All",
  "Discovery",
  "Frontend",
  "Testing",
  "Code Quality",
  "Docs",
  "DevOps",
  "Databases",
  "Marketing",
  "Workflow",
] as const;

// Curated from the public skills.sh leaderboard, prioritizing high-install GitHub-hosted
// skills with broad usefulness for app, website, documentation, and agent workflows.
export const curatedSkillsCatalog: CuratedSkill[] = [
  {
    id: "find-skills",
    name: "Find Skills",
    repository: "vercel-labs/skills",
    description: "Search and choose agent skills from the open skills ecosystem.",
    category: "Discovery",
    installs: "2.2M",
    tags: ["search", "skills", "onboarding"],
  },
  {
    id: "frontend-design",
    name: "Frontend Design",
    repository: "anthropics/skills",
    description: "Create distinctive production-grade frontend interfaces with stronger visual direction.",
    category: "Frontend",
    installs: "579K",
    tags: ["ui", "design", "frontend"],
  },
  {
    id: "vercel-react-best-practices",
    name: "Vercel React Best Practices",
    repository: "vercel-labs/agent-skills",
    description: "React and Next.js performance rules maintained around Vercel-style app patterns.",
    category: "Frontend",
    installs: "496K",
    tags: ["react", "nextjs", "performance"],
  },
  {
    id: "agent-browser",
    name: "Agent Browser",
    repository: "vercel-labs/agent-browser",
    description: "Browser-oriented workflows for agents that need to inspect and verify web pages.",
    category: "Testing",
    installs: "475K",
    tags: ["browser", "qa", "web"],
  },
  {
    id: "web-design-guidelines",
    name: "Web Design Guidelines",
    repository: "vercel-labs/agent-skills",
    description: "Practical spacing, typography, interaction, and accessibility guidance for web UI.",
    category: "Frontend",
    installs: "410K",
    tags: ["design", "accessibility", "web"],
  },
  {
    id: "remotion-best-practices",
    name: "Remotion Best Practices",
    repository: "remotion-dev/skills",
    description: "Guidance for building video compositions and automations with Remotion.",
    category: "Frontend",
    installs: "386K",
    tags: ["video", "react", "remotion"],
  },
  {
    id: "grill-me",
    name: "Grill Me",
    repository: "mattpocock/skills",
    description: "Force clearer reasoning by challenging weak assumptions before implementation.",
    category: "Code Quality",
    installs: "372K",
    tags: ["review", "reasoning", "quality"],
  },
  {
    id: "improve-codebase-architecture",
    name: "Improve Codebase Architecture",
    repository: "mattpocock/skills",
    description: "Review and improve application architecture with pragmatic refactoring guidance.",
    category: "Code Quality",
    installs: "306K",
    tags: ["architecture", "refactor", "quality"],
  },
  {
    id: "grill-with-docs",
    name: "Grill With Docs",
    repository: "mattpocock/skills",
    description: "Push implementation decisions against documentation instead of memory alone.",
    category: "Docs",
    installs: "304K",
    tags: ["docs", "review", "research"],
  },
  {
    id: "tdd",
    name: "TDD",
    repository: "mattpocock/skills",
    description: "Use test-driven development loops for focused implementation work.",
    category: "Testing",
    installs: "289K",
    tags: ["tests", "tdd", "quality"],
  },
  {
    id: "skill-creator",
    name: "Skill Creator",
    repository: "anthropics/skills",
    description: "Create new agent skills with a good structure and clear trigger behavior.",
    category: "Workflow",
    installs: "283K",
    tags: ["skills", "authoring", "workflow"],
  },
  {
    id: "caveman",
    name: "Caveman",
    repository: "juliusbrussee/caveman",
    description: "Compress communication and context for terse, high-signal agent workflows.",
    category: "Workflow",
    installs: "276K",
    tags: ["context", "tokens", "workflow"],
  },
  {
    id: "to-prd",
    name: "To PRD",
    repository: "mattpocock/skills",
    description: "Turn product ideas into clearer product requirement documents.",
    category: "Workflow",
    installs: "270K",
    tags: ["prd", "planning", "product"],
  },
  {
    id: "to-issues",
    name: "To Issues",
    repository: "mattpocock/skills",
    description: "Convert plans and requirements into actionable implementation issues.",
    category: "Workflow",
    installs: "259K",
    tags: ["issues", "planning", "github"],
  },
  {
    id: "supabase-postgres-best-practices",
    name: "Supabase Postgres Best Practices",
    repository: "supabase/agent-skills",
    description: "Postgres and Supabase database guidance for schema and query work.",
    category: "Databases",
    installs: "247K",
    tags: ["supabase", "postgres", "sql"],
  },
  {
    id: "github-actions-docs",
    name: "GitHub Actions Docs",
    repository: "xixu-me/skills",
    description: "Reference workflows, CI configuration, and GitHub Actions docs while editing automation.",
    category: "DevOps",
    installs: "237K",
    tags: ["github", "actions", "ci"],
  },
  {
    id: "triage",
    name: "Triage",
    repository: "mattpocock/skills",
    description: "Sort bugs, tasks, and project issues into clearer priorities and next steps.",
    category: "Workflow",
    installs: "234K",
    tags: ["issues", "planning", "triage"],
  },
  {
    id: "ui-ux-pro-max",
    name: "UI UX Pro Max",
    repository: "nextlevelbuilder/ui-ux-pro-max-skill",
    description: "Advanced UI/UX patterns for complex interfaces and interaction-heavy apps.",
    category: "Frontend",
    installs: "231K",
    tags: ["ui", "ux", "product"],
  },
  {
    id: "diagnose",
    name: "Diagnose",
    repository: "mattpocock/skills",
    description: "Diagnose technical problems before jumping into a fix.",
    category: "Code Quality",
    installs: "230K",
    tags: ["debug", "diagnosis", "quality"],
  },
  {
    id: "vercel-composition-patterns",
    name: "Vercel Composition Patterns",
    repository: "vercel-labs/agent-skills",
    description: "React composition patterns for reusable and scalable component APIs.",
    category: "Frontend",
    installs: "221K",
    tags: ["react", "components", "architecture"],
  },
  {
    id: "shadcn",
    name: "shadcn/ui",
    repository: "shadcn/ui",
    description: "Component usage, customization, and Tailwind integration guidance for shadcn/ui.",
    category: "Frontend",
    installs: "202K",
    tags: ["shadcn", "tailwind", "components"],
  },
  {
    id: "caveman-commit",
    name: "Caveman Commit",
    repository: "juliusbrussee/caveman",
    description: "Make concise, high-signal commits with compressed reasoning support.",
    category: "Workflow",
    installs: "180K",
    tags: ["git", "commit", "workflow"],
  },
  {
    id: "systematic-debugging",
    name: "Systematic Debugging",
    repository: "obra/superpowers",
    description: "Debug failures methodically with observations, hypotheses, and verification.",
    category: "Code Quality",
    installs: "156K",
    tags: ["debug", "testing", "quality"],
  },
  {
    id: "pptx",
    name: "PowerPoint",
    repository: "anthropics/skills",
    description: "Create and edit PowerPoint deck artifacts with layout-aware workflows.",
    category: "Docs",
    installs: "155K",
    tags: ["slides", "pptx", "documents"],
  },
  {
    id: "writing-plans",
    name: "Writing Plans",
    repository: "obra/superpowers",
    description: "Write implementation plans that are explicit enough for agent execution.",
    category: "Workflow",
    installs: "155K",
    tags: ["planning", "workflow", "agents"],
  },
  {
    id: "vercel-react-native-skills",
    name: "Vercel React Native Skills",
    repository: "vercel-labs/agent-skills",
    description: "React Native patterns and implementation guidance for mobile apps.",
    category: "Frontend",
    installs: "149K",
    tags: ["react-native", "mobile", "frontend"],
  },
  {
    id: "seo-audit",
    name: "SEO Audit",
    repository: "coreyhaines31/marketingskills",
    description: "Audit website SEO opportunities and produce practical improvement steps.",
    category: "Marketing",
    installs: "144K",
    tags: ["seo", "marketing", "website"],
  },
  {
    id: "high-end-visual-design",
    name: "High-End Visual Design",
    repository: "leonxlnx/taste-skill",
    description: "Push frontend visuals toward premium design polish and stronger taste.",
    category: "Frontend",
    installs: "142K",
    tags: ["visual", "design", "frontend"],
  },
  {
    id: "pdf",
    name: "PDF",
    repository: "anthropics/skills",
    description: "Read, create, inspect, render, and verify PDF files where layout matters.",
    category: "Docs",
    installs: "141K",
    tags: ["pdf", "documents", "layout"],
  },
  {
    id: "docx",
    name: "Word Documents",
    repository: "anthropics/skills",
    description: "Create, edit, redline, and verify Word document artifacts.",
    category: "Docs",
    installs: "133K",
    tags: ["docx", "documents", "word"],
  },
];

export function skillInstallCommand(skill: CuratedSkill) {
  return `npx skills add https://github.com/${skill.repository} --skill ${skill.id}`;
}

export function skillGitHubUrl(skill: CuratedSkill) {
  return `https://github.com/${skill.repository}`;
}

export function skillDirectoryUrl(skill: CuratedSkill) {
  return `https://www.skills.sh/${skill.repository}/${skill.id}`;
}

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
