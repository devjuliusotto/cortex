import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";

const CortexScene = lazy(() =>
  import("./CortexScene.jsx").then(module => ({ default: module.CortexScene })),
);

const releaseUrl = "https://github.com/devjuliusotto/cortex/releases";
const repositoryUrl = "https://github.com/devjuliusotto/cortex";
const releasesApiUrl = "https://api.github.com/repos/devjuliusotto/cortex/releases";
const portfolioUrl = "https://juliusotto.dev";
const coffeeUrl = "https://www.buymeacoffee.com/devjuliusotto";
const contactUrl = "https://juliusotto.vercel.app/contact";
const privacyPolicyUrl = "/privacy-policy";
const installerExitCodesPath = "/installer-exit-codes";
const legalCopy = {
  navPrivacy: "Privacy",
  title: "Privacy and data",
  intro: "Cortex and this website are designed to stay simple, local-first, and free of tracking.",
  dataTitle: "How your data is handled",
  dataItems: [
    "Cortex does not collect, transmit, sell, analyze, or share personal data.",
    "Settings, workspaces, notes, and terminal data stay locally on your device.",
    "The app does not include advertising, tracking, analytics, telemetry, or user profiling.",
    "Cortex can launch local AI agent CLIs, but it does not call AI APIs or upload prompts by itself.",
    "The website does not set cookies and does not use analytics.",
    "Downloads and source code are hosted on GitHub; when you open external links, those services' policies apply.",
  ],
  policyTitle: "Privacy policy",
  policyBody:
    "Cortex is a free and open-source application. The public source code lets anyone verify how the app handles data.",
  provider: "Service provider",
  contact: "Contact",
  updated: "Last updated: June 2026",
};

const imageExtensions = ["png", "jpg", "jpeg", "webp"];
const videoSources = ["/media/video-geral.webm", "/media/video-geral.mp4", "/media/cortex-overview.webm", "/media/cortex-overview.mp4"];

const productHighlights = [
  {
    title: "Isolated projects",
    text: "Each workspace keeps its own path, layout, notes, history, commands, and terminals separated by project.",
  },
  {
    title: "My Agents",
    text: "Detect, install, and launch local coding agents such as Gemini CLI, Claude Code, Codex, Aider, OpenCode, Continue, Copilot CLI, and Shell GPT.",
  },
  {
    title: "Office View",
    text: "A visual workspace shows active, completed, waiting, and error states across running agent terminals.",
  },
  {
    title: "Terminal GUI",
    text: "Use tabs, panes, Git Map, notes, and the command palette to operate your terminal with less friction.",
  },
  {
    title: "Developer tools Marketplace",
    text: "Install and update common Windows developer tools with visible WinGet commands instead of hidden installers.",
  },
  {
    title: "Windows-first",
    text: "PowerShell, CMD, and WSL Ubuntu with ConPTY, per-session cwd, and support for OneDrive paths and spaces.",
  },
  {
    title: "Local-first",
    text: "No telemetry, analytics, cloud sync, or background model calls. State stays in local app data.",
  },
  {
    title: "Release helper",
    text: "Git Map helps prepare versions, tags, changelogs, and publishing without leaving the workspace.",
  },
];

const coreSections = [
  {
    title: "Multi-project without confusion",
    text: "Separate agents, servers, and shells by project. Cortex keeps each workspace with its own paths, panes, notes, and commands.",
    view: "workspace",
  },
  {
    title: "Agent control surface",
    text: "My Agents turns local CLI agents into a managed catalog: check what is installed, review install commands, and open the agent in the active workspace.",
    view: "my-agents",
  },
  {
    title: "Office View",
    text: "Watch parallel agent work as a visual status floor, then jump back into the exact terminal that needs attention.",
    view: "office",
  },
  {
    title: "Git Map",
    text: "Understand overview, changes, history, branches, merges, stashes, blame, and releases without pulling focus away from the terminal.",
    view: "git",
  },
  {
    title: "Notes, commands, and history",
    text: "Save prompts, setup commands, checklists, and history per project. Lose less context between AI sessions.",
    view: "commands",
  },
  {
    title: "Marketplace without hidden runtime code",
    text: "Install developer tools, open feedback issues, manage Office View, and prepare for optional templates while keeping commands visible.",
    view: "marketplace",
  },
];

const metrics = [
  ["0.1.46", "app version"],
  ["8", "Git Map tabs"],
  ["8", "agent CLIs catalogued"],
  ["19", "WinGet tools"],
  ["0", "telemetry"],
];

const gallery = [
  {
    title: "Workspace terminal",
    sources: imageExtensions.map(extension => `/media/1.${extension}`),
    description: "Terminal, Git Map, history, and notes in the same local workspace.",
  },
  {
    title: "Git Map",
    sources: imageExtensions.map(extension => `/media/2.${extension}`),
    description: "Overview, changes, history, branches, merge, stashes, blame, and releases without switching tools.",
  },
  {
    title: "My Agents",
    sources: imageExtensions.map(extension => `/media/3.${extension}`),
    description: "Detect installed agent CLIs, review install commands, and launch them in the current workspace.",
  },
  {
    title: "Office View",
    sources: imageExtensions.map(extension => `/media/4.${extension}`),
    description: "A visual agent floor for running, waiting, completed, and errored terminal sessions.",
  },
  {
    title: "Marketplace",
    sources: imageExtensions.map(extension => `/media/5.${extension}`),
    description: "WinGet developer tools, feedback, templates, add-ons, and Office View controls.",
  },
];

const docs = [
  {
    id: "start",
    label: "Quick start",
    title: "Install and create your first workspace",
    summary: "Download the installer, create a workspace, and set the project folder that will receive terminals, notes, Git Map, and agents.",
    steps: [
      "Download the Windows installer from GitHub Releases.",
      "Create a workspace for each important project.",
      "Set the default working directory in the workspace menu.",
      "Open PowerShell, CMD, or WSL Ubuntu inside the saved context.",
    ],
    command: "npm run tauri:dev",
  },
  {
    id: "workspace",
    label: "Workspaces",
    title: "Workspaces separate projects and agents",
    summary: "Each workspace controls path, color, auto-start, snippets, notes, sessions, history, and layout.",
    steps: [
      "Use the sidebar menu to rename, duplicate, color, or remove workspaces.",
      "Enable auto-start to launch terminals when the workspace opens.",
      "Use notes and snippets to save project-specific commands.",
      "Invalid paths fall back to the user folder with a visible warning.",
    ],
    command: "C:\\Projects\\Cortex",
  },
  {
    id: "agents",
    label: "My Agents",
    title: "Discover and launch local agent CLIs",
    summary: "My Agents detects installed coding agents, previews install commands, and opens the selected agent in the active workspace.",
    steps: [
      "Open My Agents from the sidebar.",
      "Refresh detection to check installed CLIs.",
      "Review the install command before running a background install.",
      "Open the agent in a new PowerShell session tied to the active workspace.",
    ],
    command: "codex",
  },
  {
    id: "office",
    label: "Office View",
    title: "Visualize parallel agent work",
    summary: "Office View turns terminal activity into a status map across workspaces and can also run in a separate window.",
    steps: [
      "Enable Office View from Marketplace add-ons if it is disabled.",
      "Use the Terminal/Office switch in the workspace header.",
      "Open Office in a separate window for a second monitor.",
      "Select a terminal from Office View to jump back into the active session.",
    ],
    command: "Cortex Office View",
  },
  {
    id: "git",
    label: "Git Map",
    title: "Operational Git inside the workspace",
    summary: "Cortex shows status, history, branches, and release info for the active repository.",
    steps: [
      "Open a workspace with a folder that contains `.git`.",
      "Review changes, stage, unstage, commit, fetch, pull, and push.",
      "Use merge preview, stashes, blame, history, and branch details without leaving the app.",
      "Use the Releases tab to prepare tags and release notes.",
    ],
    command: "git status",
  },
  {
    id: "marketplace",
    label: "Marketplace",
    title: "Install tools and manage add-ons",
    summary: "The Marketplace exposes visible commands for WinGet developer tools, feedback, templates, and built-in add-ons.",
    steps: [
      "Search the Developer Tools catalog by name, package ID, or category.",
      "Run install, update, check updates, or update all through visible WinGet commands.",
      "Open prefilled GitHub issues manually from the Feedback tab.",
      "Enable or disable Office View from Add-ons.",
    ],
    command: "winget install --id Git.Git --exact --source winget",
  },
  {
    id: "privacy",
    label: "Privacy",
    title: "Local-first model",
    summary: "Cortex was designed as a local tool, not a remote service.",
    steps: [
      "No tracking, analytics, telemetry, or cloud sync.",
      "No built-in AI model calls or automatic prompt uploads.",
      "Update checks use GitHub Releases only when you choose to check.",
      "Feedback opens GitHub Issues in the browser and does not send data automatically.",
    ],
    command: "%APPDATA%\\dev.cortex.workspace",
  },
];

const demoProjects = [
  {
    id: "cortex",
    name: "Cortex",
    path: "C:\\Projects\\Cortex",
    agent: "Codex Agent",
    command: "codex --dangerously-auto-run",
    note: "Refine the landing page, validate the build, and prepare the release.",
    git: "main · 2 files changed",
    output: ["agent: scanning website/src", "task: improve demo + docs", "status: build passing"],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    path: "C:\\Projects\\portfolio",
    agent: "UI Agent",
    command: "npm run dev -- --host 127.0.0.1",
    note: "Compare hero, loader, and navigation with the personal website.",
    git: "main · clean",
    output: ["vite: ready in 420ms", "browser: localhost open", "agent: checking visual rhythm"],
  },
  {
    id: "api",
    name: "API Server",
    path: "C:\\Projects\\api-server",
    agent: "Test Agent",
    command: "npm test -- --watch",
    note: "Keep tests running while another agent works on the frontend.",
    git: "feature/auth · 1 commit ahead",
    output: ["tests: 42 passed", "watch: waiting for changes", "agent: monitoring regressions"],
  },
];

const roadmapItems = [
  "More persistent terminal runtime through a local tray process.",
  "Workspace profile import and export.",
  "Optional local templates and add-ons in the Marketplace.",
  "A stricter extension model before any third-party runtime code is allowed.",
  "Signed Windows installer.",
];

const pages = [
  { id: "home", label: "Home" },
  { id: "demo", label: "Demo" },
  { id: "features", label: "Features" },
  { id: "agents", label: "Agents" },
  { id: "marketplace", label: "Marketplace" },
  { id: "docs", label: "Docs" },
  { id: "installer-exit-codes", label: "Exit Codes", path: installerExitCodesPath },
  { id: "privacy", label: "Privacy" },
  { id: "about", label: "About" },
];

function getPageFromLocation() {
  if (window.location.pathname === installerExitCodesPath) {
    return "installer-exit-codes";
  }

  const hash = window.location.hash.replace("#", "");
  return pages.some(page => page.id === hash) || hash === "download" ? hash : "home";
}

function useFirstAvailable(sources) {
  const [source, setSource] = useState("");

  useEffect(() => {
    let active = true;

    async function findAsset() {
      for (const candidate of sources) {
        try {
          const response = await fetch(candidate, { method: "HEAD" });
          if (response.ok && active) {
            setSource(candidate);
            return;
          }
        } catch {
          // Keep the fallback UI when local media is not available yet.
        }
      }
    }

    void findAsset();

    return () => {
      active = false;
    };
  }, [sources.join("|")]);

  return source;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatBytes(value) {
  if (!value) {
    return "";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function isInstallerAsset(asset) {
  return /\.(exe|msi|msix|zip|7z)$/i.test(asset.name);
}

function AppMockup({ compact = false }) {
  return (
    <div className={`mockup ${compact ? "compact" : ""}`} aria-label="Cortex app preview">
      <div className="mockSidebar">
        <div className="mockLogo">
          <img src="/cortex-logo.svg" alt="" />
          <span>Cortex</span>
        </div>
        {["Portfolio", "Cortex", "API Server", "Docs"].map((item, index) => (
          <div className={`mockWorkspace ${index === 1 ? "active" : ""}`} key={item}>
            <span />
            {item}
          </div>
        ))}
        <div className="mockSidebarFooter" />
      </div>
      <div className="mockMain">
        <div className="mockTopbar">
          <div>
            <strong>Cortex</strong>
            <small>Git Map aberto · Workspace path: C:\Projects\Cortex</small>
          </div>
          <div className="mockActions">
            <span>local data</span>
            <span>no telemetry</span>
          </div>
        </div>
        <div className="mockTerminalGrid">
          <div className="mockTerminal">
            <div className="mockTabs">
              <span className="on">PowerShell</span>
              <span>Git Map</span>
              <span>History</span>
              <span>Notes</span>
            </div>
            <pre>{`PS C:\\Projects\\Cortex> git status
 on branch main
 changes staged: website refresh

 git map: clean release path
 command palette: 38 actions
 workspace layout restored`}</pre>
          </div>
          {!compact && (
            <div className="mockPanel">
              <span className="panelTitle">Git Map</span>
              <p>Overview, changes, history, branches and releases stay visible beside the shell.</p>
              <div className="snippet">Release v0.1.46</div>
              <div className="snippet">git push origin main</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Hero3DStage() {
  return (
    <div className="hero3dStage" aria-hidden="true">
      <div className="stageOrbit orbitOne" />
      <div className="stageOrbit orbitTwo" />
      <div className="stageOrbit orbitThree" />
      <div className="stageCore">
        <img src="/cortex-logo.svg" alt="" />
      </div>
      <div className="stageSignal signalOne" />
      <div className="stageSignal signalTwo" />
      <div className="stageSignal signalThree" />
      <div className="stageCaption">
        {/* <span>local workspace</span> */}
        {/* <strong>CORTEX</strong> */}
      </div>
    </div>
  );
}

function ImpactReveal() {
  return (
    <section className="impactReveal" aria-label="Cortex product statement">
      <div className="impactLine">
        <span>Git visual</span>
        <span>Multi-project</span>
        <span>AI agents</span>
        <span>Windows</span>
      </div>
      <h2>Learn, run, and organize without memorizing everything at once.</h2>
    </section>
  );
}

function HomeValue() {
  const cards = [
    {
      title: "Git becomes visual",
      text: "See changes, branches, and commits in a clear interface. Learn the flow before memorizing commands.",
    },
    {
      title: "Agents without clutter",
      text: "Run Codex, tests, and servers in separate panes. Each process stays in the right project.",
    },
    {
      title: "Separate projects",
      text: "Paths, notes, commands, and history are saved per workspace. Nothing gets mixed.",
    },
  ];

  return (
    <section className="homeValue">
      <div className="homeValueHeader">
        <span className="sectionEyebrow">Why Cortex</span>
        <h2>Built to learn, create, and run multiple flows at the same time.</h2>
        <p>
          A regular terminal runs commands. Cortex organizes the whole project: Git, agents,
          notes, history, and saved commands in a local GUI.
        </p>
      </div>
      <div className="homeValueGrid">
        {cards.map(card => (
          <article className="homeValueCard" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

const officeAgents = [
  { id: "code", label: "Coding", detail: "editing the feature", status: "active" },
  { id: "test", label: "Testing", detail: "42 checks passing", status: "success" },
  { id: "review", label: "Reviewing", detail: "reading the diff", status: "active" },
  { id: "wait", label: "Waiting", detail: "needs your input", status: "waiting" },
];

const agentCards = [
  {
    title: "Installed",
    text: "Cortex checks local commands and separates installed agents from available ones.",
    meta: "where codex",
  },
  {
    title: "Available",
    text: "Install commands are visible before they run. Background installs report success or errors in the app.",
    meta: "npm install -g @google/gemini-cli",
  },
  {
    title: "Skills",
    text: "Curated public skills, global folders, and workspace skill folders are managed from the same page.",
    meta: "30 curated skills",
  },
  {
    title: "Extensions",
    text: "Gemini CLI extensions can be installed from GitHub with command previews and local workspace context.",
    meta: "gemini extensions install",
  },
];

const agentNames = ["Gemini CLI", "Claude Code", "Aider", "Codex CLI", "OpenCode", "Continue CLI", "GitHub Copilot CLI", "Shell GPT"];

const marketplaceCards = [
  {
    title: "Developer Tools",
    text: "Install Git, GitHub CLI, PowerShell, Node.js, Python, Rust, VS Code, Docker, kubectl, cloud CLIs, and more through WinGet.",
  },
  {
    title: "Feedback",
    text: "Build a prefilled GitHub issue for bugs, feature requests, templates, or general feedback. Submission stays manual.",
  },
  {
    title: "Templates",
    text: "Workspace templates are staged behind a disabled flag so Cortex can add them later without crowding the default UI.",
  },
  {
    title: "Add-ons",
    text: "Office View is managed as a built-in add-on. There is still no third-party plugin runtime in this version.",
  },
];

function PixelAgent({ agent, index }) {
  return (
    <div className={`pixelDesk ${agent.status}`} style={{ "--agent-delay": `${index * -0.7}s` }}>
      <div className="pixelMonitor"><span /></div>
      <div className="pixelPerson" aria-hidden="true">
        <i className="pixelHead" />
        <i className="pixelBody" />
      </div>
      <div className="pixelDeskTop" />
      <div className="pixelChair" />
      <div className="pixelAgentLabel">
        <span className="pixelStatus" />
        <div><strong>{agent.label}</strong><small>{agent.detail}</small></div>
      </div>
    </div>
  );
}

function OfficeViewShowcase() {
  return (
    <section className="officeViewSection" id="office-view">
      <div className="officeViewIntro">
        <div>
          <span className="sectionEyebrow">New · Office View</span>
          <h2>See your agents at work.</h2>
        </div>
        <div className="officeViewCopy">
          <p>
            Office View turns parallel AI work into a living pixel workspace. Each agent gets a
            visible place, activity state, and task, so you can understand the team at a glance.
          </p>
          <a className="officeTextLink" href="#office-details">Explore the view <span>↘</span></a>
        </div>
      </div>

      <div className="officeViewStage" aria-label="Pixel office showing four AI agents at work">
        <div className="officeGrid" aria-hidden="true" />
        <div className="officeWindow" aria-hidden="true">
          <span /><span /><span /><span /><span />
        </div>
        <div className="officeSign" aria-hidden="true"><img src="/cortex-logo.svg" alt="" /> agent floor</div>
        <div className="pixelOffice">
          {officeAgents.map((agent, index) => <PixelAgent agent={agent} index={index} key={agent.id} />)}
        </div>
        <div className="officeLegend" aria-hidden="true">
          <span><i className="legendActive" /> working</span>
          <span><i className="legendSuccess" /> complete</span>
          <span><i className="legendWaiting" /> waiting</span>
        </div>
      </div>

      <div className="officeDetails" id="office-details">
        <article><span>01</span><h3>Parallel work, made visible</h3><p>Follow multiple agents without opening every terminal or guessing which task is still running.</p></article>
        <article><span>02</span><h3>Status without interruption</h3><p>Spot active, completed, and waiting agents while keeping your own focus on the project.</p></article>
        <article><span>03</span><h3>A view, not extra AI usage</h3><p>The pixels visualize agent activity. Usage comes from the agents doing work, not from the animation.</p></article>
      </div>
    </section>
  );
}

function AgentsPage() {
  return (
    <section className="section agentsPage" id="agents">
      <div className="agentHeroGrid">
        <div>
          <span className="sectionEyebrow">My Agents</span>
          <h2>Local coding agents, organized like part of the workspace.</h2>
          <p>
            Cortex does not ship an AI model. It gives local agent CLIs a practical control
            surface: detection, install commands, launch buttons, skills, and extension setup.
          </p>
        </div>
        <DocScreenshot activeId="my-agents" />
      </div>

      <div className="agentNameStrip" aria-label="Supported agent catalog">
        {agentNames.map(name => <span key={name}>{name}</span>)}
      </div>

      <div className="agentFeatureGrid">
        {agentCards.map(card => (
          <article className="agentFeature" key={card.title}>
            <span>{card.meta}</span>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>

      <section className="agentFlow">
        <div>
          <span className="sectionEyebrow">Agent workflow</span>
          <h2>Install visibly. Run locally. Keep every agent tied to a project.</h2>
        </div>
        <ol>
          <li>Choose the active workspace so commands inherit the right project folder.</li>
          <li>Review the exact install or run command before Cortex creates a terminal.</li>
          <li>Use panes, Git Map, notes, Office View, and notifications to track the work.</li>
        </ol>
      </section>
    </section>
  );
}

function MarketplacePage() {
  return (
    <section className="section marketplacePage" id="marketplace">
      <div className="marketplaceHero">
        <div>
          <span className="sectionEyebrow">Marketplace</span>
          <h2>Useful installs without hiding what runs on your machine.</h2>
          <p>
            The Marketplace is intentionally conservative: visible WinGet commands, manual
            GitHub feedback, disabled template staging, and built-in add-on controls.
          </p>
        </div>
        <DocScreenshot activeId="marketplace" />
      </div>

      <div className="marketplaceGrid">
        {marketplaceCards.map(card => (
          <article className="marketplaceCard" key={card.title}>
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </article>
        ))}
      </div>

      <section className="toolMatrix" aria-label="Developer tool categories">
        {["Essentials", "Languages", "IDEs", "Databases", "Cloud & DevOps"].map(category => (
          <div key={category}>
            <span>{category}</span>
          </div>
        ))}
      </section>
    </section>
  );
}

function ProductPreview({ view }) {
  const activeId = view === "commands" ? "workspace" : view;

  return (
    <div className={`productPreview ${view}`}>
      <DocScreenshot activeId={activeId} />
    </div>
  );
}

function CoreSections() {
  return (
    <section className="coreSections" id="features">
      {coreSections.map((section, index) => (
        <article className="coreSection" key={section.title}>
          <div className="coreCopy">
            <span className="sectionEyebrow">0{index + 1}</span>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
          </div>
          <ProductPreview view={section.view} />
        </article>
      ))}
    </section>
  );
}

function MediaShowcase() {
  const videoSrc = useFirstAvailable(videoSources);
  const [activeProjectId, setActiveProjectId] = useState(demoProjects[0].id);
  const activeProject = demoProjects.find(project => project.id === activeProjectId) ?? demoProjects[0];

  return (
    <section className="section mediaSection" id="demo">
      <div className="sectionEyebrow">Interactive demo</div>
      <div className="sectionHeader">
        <h2>Switch projects without losing the right agent.</h2>
        <p>
          Click a workspace and see how terminal, Git, notes, and commands change together.
          The idea is simple: each project loads its own operational context.
        </p>
      </div>
      <p className="demoNotice">The demo mirrors the current local-first workflow: workspace, terminal, Git Map, notes, commands, agents, and Marketplace stay in one context.</p>

      <div className="interactiveDemo">
        <aside className="demoSidebar">
          <span className="demoLabel">Workspaces</span>
          {demoProjects.map(project => (
            <button
              className={project.id === activeProject.id ? "active" : ""}
              key={project.id}
              onClick={() => setActiveProjectId(project.id)}
              type="button"
            >
              <strong>{project.name}</strong>
              <small>{project.agent}</small>
            </button>
          ))}
        </aside>

        <div className="demoWorkspace">
          <div className="demoTopbar">
            <div>
              <strong>{activeProject.name}</strong>
              <small>{activeProject.path}</small>
            </div>
            <span>{activeProject.git}</span>
          </div>
          <div className="demoPanes">
            <section className="demoTerminalPane">
              <div className="paneTitle">Terminal agent</div>
              <pre>{`PS ${activeProject.path}> ${activeProject.command}
${activeProject.output.map(line => `\n${line}`).join("")}`}</pre>
            </section>
            <section className="demoSidePane">
              <div className="paneTitle">Project context</div>
              <div className="contextCard">
                <strong>Nota ativa</strong>
                <p>{activeProject.note}</p>
              </div>
              <div className="contextCard">
                <strong>Comando salvo</strong>
                <code>{activeProject.command}</code>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="videoFrame">
        {videoSrc ? (
          <video controls playsInline poster="/media/1.png" src={videoSrc} />
        ) : (
          <div className="videoFallback">
            <AppMockup compact />
          </div>
        )}
      </div>

      <div className="gallery">
        {gallery.map(item => (
          <MediaCard item={item} key={item.title} />
        ))}
      </div>
    </section>
  );
}

function MediaCard({ item }) {
  const imageSrc = useFirstAvailable(item.sources);

  return (
    <article className="mediaCard">
      <div className="mediaImage">
        {imageSrc ? (
          <img src={imageSrc} alt={item.title} />
        ) : (
          <AppMockup compact />
        )}
      </div>
      <h3>{item.title}</h3>
      <p>{item.description}</p>
    </article>
  );
}

function DocScreenshot({ activeId }) {
  const content = {
    start: {
      title: "Welcome",
      tabs: ["Workspace", "Terminal", "Docs"],
      body: ["Create workspace", "Set default path", "Open PowerShell"],
      terminal: "PS C:\\Projects\\Cortex>",
    },
    workspace: {
      title: "Workspace settings",
      tabs: ["Color", "Auto-start", "Path"],
      body: ["C:\\Projects\\Cortex", "Auto-start enabled", "Local snippets: 6"],
      terminal: "workspace restored",
    },
    agents: {
      title: "AI agents",
      tabs: ["Codex", "Server", "Tests"],
      body: ["Agent A: landing page", "Agent B: tests watching", "Agent C: release notes"],
      terminal: "codex --workspace .",
    },
    git: {
      title: "Git Map",
      tabs: ["Overview", "Changes", "History", "Branches", "Merge", "Stashes", "Blame", "Releases"],
      body: ["main · clean", "v0.1.46 ready", "merge preview", "stashes: 2"],
      terminal: "git push origin main",
    },
    office: {
      title: "Office View",
      tabs: ["Working", "Complete", "Waiting"],
      body: ["Codex: editing feature", "Tests: 42 passed", "Claude: waiting for input"],
      terminal: "open office window",
    },
    "my-agents": {
      title: "My Agents",
      tabs: ["Installed", "Available", "Skills", "Extensions"],
      body: ["Codex CLI installed", "Gemini CLI available", "30 curated skills"],
      terminal: "npm install -g @openai/codex",
    },
    marketplace: {
      title: "Marketplace",
      tabs: ["Tools", "Feedback", "Templates", "Add-ons"],
      body: ["19 WinGet packages", "Office View enabled", "Manual GitHub issues"],
      terminal: "winget upgrade --all --source winget",
    },
    privacy: {
      title: "Local-first",
      tabs: ["App data", "No telemetry", "Manual update"],
      body: ["No analytics", "No cloud sync", "No background AI calls"],
      terminal: "%APPDATA%\\dev.cortex.workspace",
    },
  }[activeId] ?? {
    title: "Cortex",
    tabs: ["Workspace"],
    body: ["Local-first"],
    terminal: "ready",
  };

  return (
    <div className="docScreenshot" aria-hidden="true">
      <div className="shotSidebar">
        <img src="/cortex-logo.svg" alt="" />
        <span />
        <span />
        <span />
      </div>
      <div className="shotMain">
        <div className="shotTopbar">
          <strong>{content.title}</strong>
          <small>local session</small>
        </div>
        <div className="shotTabs">
          {content.tabs.map(tab => (
            <span key={tab}>{tab}</span>
          ))}
        </div>
        <div className="shotBody">
          {content.body.map(item => (
            <div key={item}>{item}</div>
          ))}
        </div>
        <pre>{content.terminal}</pre>
      </div>
    </div>
  );
}

function Documentation() {
  const [activeId, setActiveId] = useState(docs[0].id);
  const activeDoc = useMemo(() => docs.find(item => item.id === activeId) ?? docs[0], [activeId]);

  return (
    <section className="section docsSection" id="docs">
      <div className="docsLayout">
        <aside className="docsSidebar">
          <div>
            <span className="sectionEyebrow">Docs</span>
            <h2>Cortex docs</h2>
            <p>Quick guide for using Cortex as a multi-project terminal and local panel for agents.</p>
          </div>
          <nav className="docTabs" role="tablist" aria-label="Documentation sections">
          {docs.map(item => (
            <button
              aria-controls={`doc-panel-${item.id}`}
              aria-selected={item.id === activeDoc.id}
              className={item.id === activeDoc.id ? "active" : ""}
              id={`doc-tab-${item.id}`}
              key={item.id}
              onClick={() => setActiveId(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
          </nav>
        </aside>

        <article
          aria-labelledby={`doc-tab-${activeDoc.id}`}
          className="docsArticle"
          id={`doc-panel-${activeDoc.id}`}
          role="tabpanel"
        >
          <header className="docsArticleHeader">
            <span className="docLabel">{activeDoc.label}</span>
            <h3>{activeDoc.title}</h3>
            <p>{activeDoc.summary}</p>
          </header>

          <div className="docsArticleGrid">
            <section className="docsBlock">
              <h4>How it works</h4>
              <ol>
                {activeDoc.steps.map(step => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>

            <section className="docsBlock commandBlock">
              <h4>Example command</h4>
              <pre>{activeDoc.command}</pre>
            </section>
          </div>

          <DocScreenshot activeId={activeDoc.id} />

          <section className="docsNote">
            <strong>Mental model</strong>
            <p>
              Think of Cortex as a local GUI for switching between projects, keeping agents running
              in parallel, and preserving the context that usually gets scattered across terminal,
              editor, notes, and Git.
            </p>
          </section>
        </article>
      </div>
    </section>
  );
}

function DownloadCenter() {
  const [releases, setReleases] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;

    async function loadReleases() {
      try {
        const response = await fetch(releasesApiUrl, {
          headers: { Accept: "application/vnd.github+json" },
        });

        if (!response.ok) {
          throw new Error(`GitHub returned ${response.status}`);
        }

        const data = await response.json();
        if (active) {
          setReleases(data.filter(release => !release.draft));
          setStatus("ready");
        }
      } catch {
        if (active) {
          setStatus("error");
        }
      }
    }

    void loadReleases();

    return () => {
      active = false;
    };
  }, []);

  const latest = releases[0];
  const latestAssets = latest?.assets?.filter(isInstallerAsset) ?? [];

  return (
    <section className="section download downloadCenter" id="download">
      <div className="downloadHeader">
        <span className="sectionEyebrow">Download center</span>
        <p>
          Cortex is still unsigned, so Microsoft SmartScreen may ask for confirmation. This page
          reads public GitHub releases and shows the latest installer when one exists.
        </p>
      </div>

      <div className="releasePanel">
        {status === "loading" && <div className="releaseState">Syncing releases...</div>}
        {status === "error" && (
          <div className="releaseState">
            Could not read the API right now. <a href={releaseUrl}>Open GitHub Releases</a>
          </div>
        )}
        {status === "ready" && !latest && (
          <div className="releaseState">
            There are no public releases yet. <a href={releaseUrl}>Open releases page</a>
          </div>
        )}
        {latest && (
          <>
            <article className="latestRelease">
              <div>
                <span className="releaseBadge">Latest</span>
                <h3>{latest.name || latest.tag_name}</h3>
                <p>{latest.published_at ? formatDate(latest.published_at) : "Release without publish date"}</p>
              </div>
              <a className="button secondary" href={latest.html_url}>
                Ver detalhes
              </a>
            </article>

            <div className="assetList">
              {latestAssets.length > 0 ? (
                latestAssets.map(asset => (
                  <a className="assetDownload" href={asset.browser_download_url} key={asset.id}>
                    <span>
                      <strong>{asset.name}</strong>
                      <small>{formatBytes(asset.size)} · {asset.download_count} downloads</small>
                    </span>
                    <b>Download</b>
                  </a>
                ))
              ) : (
                <div className="releaseState compact">
                  This release does not include `.exe`, `.msi`, `.msix`, or `.zip`. <a href={latest.html_url}>Open release</a>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {releases.length > 1 && (
        <div className="releaseArchive">
          <h3>Previous versions</h3>
          {releases.slice(1, 7).map(release => {
            const assets = release.assets?.filter(isInstallerAsset) ?? [];
            return (
              <article className="archiveItem" key={release.id}>
                <div>
                  <strong>{release.name || release.tag_name}</strong>
                  <small>{release.published_at ? formatDate(release.published_at) : release.tag_name}</small>
                </div>
                <div className="archiveLinks">
                  {assets.slice(0, 3).map(asset => (
                    <a href={asset.browser_download_url} key={asset.id}>{asset.name}</a>
                  ))}
                  {assets.length === 0 && <a href={release.html_url}>Ver release</a>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SupportAndAbout() {
  return (
    <section className="section supportAbout" id="about">
      <div className="sectionEyebrow">Support & About</div>
      <div className="supportGrid">
        <article className="supportPanel coffeePanel">
          <span className="panelKicker">Buy Me a Coffee</span>

          <h2>Support Cortex's development.</h2>

          <p>
            Cortex is completely free and open source. Donations help cover the
            project's ongoing costs, including hosting, domain renewals, developer
            accounts, application publishing, and future updates.
          </p>

          <p>
            Every contribution helps keep Cortex actively maintained and available
            to everyone.
          </p>

          <a
            className="button coffeeButton"
            href="https://www.buymeacoffee.com/juliusottode"
            target="_blank"
            rel="noopener noreferrer"
          >
            ☕ Buy me a coffee
          </a>
        </article>



      


        <article className="supportPanel aboutPanel">
          <span className="panelKicker">Open Source</span>

          <h2>Built by developers, for developers.</h2>

          <p>
            Cortex is an independent open-source project focused on creating a better
            terminal workspace experience. No subscriptions, no telemetry, no vendor
            lock-in — just powerful tools that stay under your control.
          </p>

          <p>
            The project is actively maintained by Julius Otto and developed in the
            open with community feedback and contributions.
          </p>

          <div className="aboutLinks">
            <a href={repositoryUrl}>GitHub</a>
            <a href="/changelog">Changelog</a>
            <a href="/privacy">Privacy</a>
            <a href={contactUrl}>Support</a>
          </div>
        </article>
      </div>
    </section>
  );
}

function LegalPrivacyPage() {
  return (
    <section className="section legalSection" id="privacy">
      <div className="legalHeader">
        <div>
          <span className="sectionEyebrow">{legalCopy.updated}</span>
          <h2>{legalCopy.title}</h2>
          <p>{legalCopy.intro}</p>
        </div>
      </div>

      <div className="legalGrid">
        <article className="legalPanel">
          <span className="panelKicker">Data</span>
          <h3>{legalCopy.dataTitle}</h3>
          <ul>
            {legalCopy.dataItems.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a className="legalInlineLink" href={privacyPolicyUrl}>
            {legalCopy.policyTitle}
          </a>
        </article>

        <article className="legalPanel">
          <span className="panelKicker">Policy</span>
          <h3>{legalCopy.policyTitle}</h3>
          <p>{legalCopy.policyBody}</p>
          <dl>
            <div>
              <dt>{legalCopy.provider}</dt>
              <dd>Julius Otto</dd>
            </div>
            <div>
              <dt>{legalCopy.contact}</dt>
              <dd>
                <a href={contactUrl}>juliusotto.vercel.app/contact</a>
              </dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  );
}

function InstallerExitCodesPage() {
  return (
    <section className="section exitCodesSection" id="installer-exit-codes">
      <div className="exitCodesHeader">
        <span className="sectionEyebrow">Installer Reference</span>

        <h1>Cortex Installer Exit Codes</h1>

        <p>
          The Cortex installer may return the following exit codes during
          installation.
        </p>
      </div>

      <table className="exitCodesTable">
        <thead>
          <tr>
            <th>Code</th>
            <th>Description</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>0</td>
            <td>Installation completed successfully.</td>
          </tr>

          <tr>
            <td>1</td>
            <td>Installation cancelled by the user.</td>
          </tr>

          <tr>
            <td>2</td>
            <td>The application is already installed.</td>
          </tr>

          <tr>
            <td>3</td>
            <td>Another installation is currently in progress.</td>
          </tr>

          <tr>
            <td>4</td>
            <td>Insufficient disk space available.</td>
          </tr>

          <tr>
            <td>5</td>
            <td>A system restart is required.</td>
          </tr>

          <tr>
            <td>6</td>
            <td>A network-related error occurred.</td>
          </tr>

          <tr>
            <td>7</td>
            <td>The package was blocked by a device security policy.</td>
          </tr>

          <tr>
            <td>8</td>
            <td>A generic installation error occurred.</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}


export function App() {
  const [introDone, setIntroDone] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [activePage, setActivePage] = useState(getPageFromLocation);

  useEffect(() => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setLoadProgress(Math.min(100, Math.round((elapsed / 460) * 100)));
    }, 24);
    const timer = window.setTimeout(() => {
      setLoadProgress(100);
      setIntroDone(true);
    }, 520);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleLocationChange = () => setActivePage(getPageFromLocation());

    window.addEventListener("hashchange", handleLocationChange);
    window.addEventListener("popstate", handleLocationChange);
    return () => {
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
    };
  }, []);

  function selectPage(pageId) {
    setActivePage(pageId);
    const page = pages.find(item => item.id === pageId);
    window.history.pushState(null, "", page?.path ?? `/#${pageId}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className={`siteShell ${introDone ? "introDone" : ""}`}>
      <div className={`introLoader ${introDone ? "hide" : ""}`} aria-hidden={introDone}>
        <div className="loaderGrid" />
        <div className="loaderMark">
          <div className="loaderDonut" style={{ "--progress": `${loadProgress}%` }}>
            <strong>{loadProgress}</strong>
          </div>
          <span>LOADING CORTEX</span>
        </div>
      </div>

      <Suspense fallback={<div className="cortexScene" aria-hidden="true"><div className="sceneFallback" /></div>}>
        <CortexScene />
      </Suspense>

      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Cortex home">
          <img src="/cortex-logo.svg" alt="" />
          <span>Cortex</span>
        </a>
        <div className="navControls">
          <div className="navTabs" role="tablist" aria-label="Website sections">
            {pages.map(page => (
              <button
                aria-selected={activePage === page.id}
                className={activePage === page.id ? "active" : ""}
                key={page.id}
                onClick={() => selectPage(page.id)}
                role="tab"
                type="button"
              >
                {page.label}
              </button>
            ))}
          </div>
          <button className="navDownload" onClick={() => selectPage("download")} type="button">Download</button>
        </div>
      </nav>

      <div className="pagePanel" role="tabpanel">
        {activePage === "home" && (
          <>
            <section className="hero" id="top">
              <div className="heroShock" aria-hidden="true">
                <span className="shockLine shockLineA" />
                <span className="shockLine shockLineB" />
                <span className="shockNode shockNodeA" />
                <span className="shockNode shockNodeB" />
              </div>
              <div className="heroVisual" aria-hidden="true">
                <Hero3DStage />
              </div>
              <div className="heroText">
                <div className="hackerWordmark" aria-label="Cortex">
                  <span className="promptSig">~/workspace</span>
                  <h1 className="typedTitle">Cortex</h1>
                  <span className="promptStatus">root context loaded</span>
                </div>
                {/* <p className="lead heroPunch">Visual Git. Clear projects. Organized agents.</p> */}
                {/* <div className="heroActions">
                  <button className="button primary" onClick={() => selectPage("download")} type="button">
                    Download for Windows
                  </button>
                  <a className="button secondary" href={repositoryUrl}>
                    View on GitHub
                  </a>
                </div> */}
                {/* <p className="heroTrust">Free, open source, and local-first.</p> */}
                <div className="heroMeta" aria-label="Cortex quick facts">
                  {/* <span>expanded productivity</span>
                  <span>Open Source</span>
                  <span>No telemetry</span>
                  <span>your data stays on your machine</span> */}
                </div>
              </div>
            </section>

            <section className="postHero" aria-label="Cortex overview">
              <div className="postHeroHeader">
                <span className="sectionEyebrow">Why Cortex</span>
                <h2>Terminal, Git, and agents in the same context.</h2>
              </div>
              <div className="postHeroGrid">
                <article>
                  <span>01</span>
                  <h3>Learn Git without fear</h3>
                  <p>See changed files, branches, commits, merge previews, stashes, blame, and releases in a visual interface. Understand the flow before memorizing every command.</p>
                </article>
                <article>
                  <span>02</span>
                  <h3>Agents stay manageable</h3>
                  <p>Detect local coding agents, launch them into the right workspace, and watch parallel work through terminal panes or Office View.</p>
                </article>
                <article>
                  <span>03</span>
                  <h3>Tools install transparently</h3>
                  <p>Marketplace actions use visible WinGet and CLI commands. Cortex organizes the workflow without adding hidden cloud services.</p>
                </article>
              </div>
              <div className="postHeroFlow">
                <div>
                  <strong>Real workflow</strong>
                  <p>Open the project, run the agent, follow Git, note decisions, and come back tomorrow to the exact same workspace.</p>
                </div>
                <button className="button primary" onClick={() => selectPage("download")} type="button">
                  Download for Windows
                </button>
              </div>
            </section>
            <OfficeViewShowcase />
          </>
        )}

        {activePage === "demo" && <MediaShowcase />}

        {activePage === "features" && (
          <>
            <CoreSections />
            <section className="section featureGrid">
              {productHighlights.map(feature => (
                <article className="feature" key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              ))}
            </section>
            <section className="section workflowSection">
              <div className="sectionEyebrow">Workflow</div>
              <div className="workflowGrid">
                <div>
                  <h2>From terminal to release without losing context.</h2>
                  <p>
                    Cortex does not replace Git, your shell, or your editor. It organizes the surroundings:
                    the right path, the right tabs, local agents, developer tools, and release context in the same workspace.
                  </p>
                </div>
                <ol className="workflowSteps">
                  <li>Open the workspace and restore layout, terminal, notes, and Git Map.</li>
                  <li>Launch local agent CLIs from My Agents or the Command Palette.</li>
                  <li>Review status, commits, branches, stashes, blame, and release info through Git Map.</li>
                  <li>Install or update developer tools through visible Marketplace commands.</li>
                  <li>Publish the version using your local flow and GitHub Releases.</li>
                </ol>
              </div>
            </section>
            <section className="section stats">
              {metrics.map(([value, label]) => (
                <div className="stat" key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </section>
            <section className="section roadmapSection">
              <div>
                <span className="sectionEyebrow">Roadmap</span>
                <h2>Next steps with the same rule: local first.</h2>
              </div>
              <ul>
                {roadmapItems.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </>
        )}

        {activePage === "agents" && <AgentsPage />}
        {activePage === "marketplace" && <MarketplacePage />}
        {activePage === "docs" && <Documentation />}
        {activePage === "installer-exit-codes" && <InstallerExitCodesPage />}
        {activePage === "privacy" && <LegalPrivacyPage />}
        {activePage === "download" && <DownloadCenter />}
        {activePage === "about" && <SupportAndAbout />}
      </div>

      <footer className="legalFooter" aria-label="Legal links">
        <button onClick={() => selectPage("privacy")} type="button">
          Privacy
        </button>
        <a href={privacyPolicyUrl}>Privacy policy</a>
        <button onClick={() => selectPage("installer-exit-codes")} type="button">
          Installer exit codes
        </button>
      </footer>
    </main>
  );
}
