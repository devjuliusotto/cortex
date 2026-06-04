import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";

const CortexScene = lazy(() =>
  import("./CortexScene.jsx").then(module => ({ default: module.CortexScene })),
);

const releaseUrl = "https://github.com/devjuliusotto/cortex/releases";
const repositoryUrl = "https://github.com/devjuliusotto/cortex";
const releasesApiUrl = "https://api.github.com/repos/devjuliusotto/cortex/releases";
const portfolioUrl = "https://juliusotto.dev";
const coffeeUrl = "https://www.buymeacoffee.com/devjuliusotto";

const imageExtensions = ["png", "jpg", "jpeg", "webp"];
const videoSources = ["/media/video-geral.webm", "/media/video-geral.mp4", "/media/cortex-overview.webm", "/media/cortex-overview.mp4"];

const productHighlights = [
  {
    title: "Projetos isolados",
    text: "Cada workspace mantém caminho, layout, notas, histórico, comandos e terminais separados por projeto.",
  },
  {
    title: "Agentes em paralelo",
    text: "Abra vários terminais para agentes de IA, scripts e servidores sem misturar contexto entre projetos.",
  },
  {
    title: "GUI para terminal",
    text: "Use abas, panes, Git Map, notas e command palette para operar o terminal com menos fricção.",
  },
  {
    title: "Windows-first",
    text: "PowerShell, CMD e WSL Ubuntu com ConPTY, cwd por sessão e suporte a caminhos com OneDrive e espaços.",
  },
  {
    title: "Local-first",
    text: "Sem telemetria, analytics, cloud sync, AI ou chamadas externas de fundo. O estado fica no app data local.",
  },
  {
    title: "Release helper",
    text: "Comandos salvos e Git Map ajudam a preparar versão, tag, changelog e publicação sem sair do contexto.",
  },
];

const coreSections = [
  {
    title: "Multi-projeto sem confusão",
    text: "Separe agentes, servidores e shells por projeto. Cortex mantém cada workspace com seus próprios caminhos, panes, notas e comandos.",
    view: "workspace",
  },
  {
    title: "Git Map",
    text: "Entenda branches, commits, mudanças e releases sem tirar o foco dos agentes que estão rodando no terminal.",
    view: "git",
  },
  {
    title: "Notas, comandos e histórico",
    text: "Guarde prompts, comandos de setup, checklists e histórico por projeto. Menos contexto perdido entre sessões de IA.",
    view: "commands",
  },
];

const metrics = [
  ["0.1.18", "release atual"],
  ["5", "abas Git Map"],
  ["0", "telemetria"],
  ["Local", "estado do app"],
];

const gallery = [
  {
    title: "Workspace terminal",
    sources: imageExtensions.map(extension => `/media/1.${extension}`),
    description: "Terminal, Git Map, histórico e notas no mesmo workspace local.",
  },
  {
    title: "Git Map",
    sources: imageExtensions.map(extension => `/media/2.${extension}`),
    description: "Overview, changes, history, branches e releases sem trocar de ferramenta.",
  },
  {
    title: "Command Palette",
    sources: imageExtensions.map(extension => `/media/3.${extension}`),
    description: "Comandos salvos, snippets e ações recorrentes para o projeto atual.",
  },
  {
    title: "Split panes",
    sources: imageExtensions.map(extension => `/media/4.${extension}`),
    description: "Divisores arrastáveis e layouts persistidos por workspace.",
  },
  {
    title: "Local setup",
    sources: imageExtensions.map(extension => `/media/5.${extension}`),
    description: "Perfis, cwd, auto-start e notas guardados localmente.",
  },
];

const docs = [
  {
    id: "start",
    label: "Quick start",
    title: "Instalação e primeiro workspace",
    summary: "Baixe o instalador, crie um workspace e defina a pasta do projeto que vai receber terminais e agentes.",
    steps: [
      "Baixe o instalador Windows nas GitHub Releases.",
      "Crie um workspace para cada projeto importante.",
      "Defina o default working directory no menu do workspace.",
      "Abra PowerShell, CMD ou WSL Ubuntu dentro do contexto salvo.",
    ],
    command: "npm run tauri:dev",
  },
  {
    id: "workspace",
    label: "Workspaces",
    title: "Workspaces separam projetos e agentes",
    summary: "Cada workspace controla caminho, cor, auto-start, snippets, notas, sessões, histórico e layout.",
    steps: [
      "Use o menu lateral para renomear, duplicar, colorir ou remover workspaces.",
      "Ative auto-start para iniciar terminais quando o workspace abrir.",
      "Use notas e snippets para guardar comandos específicos do projeto.",
      "Caminhos inválidos caem para a pasta do usuário com aviso visível.",
    ],
    command: "C:\\Projects\\Cortex",
  },
  {
    id: "agents",
    label: "AI agents",
    title: "Rodando agentes em paralelo",
    summary: "Use panes e abas para manter agentes, servidores, testes e shells em execução sem perder qual terminal pertence a qual tarefa.",
    steps: [
      "Crie uma sessão para cada agente ou processo longo.",
      "Use splits para manter agente, servidor e Git Map visíveis.",
      "Salve comandos recorrentes para iniciar agentes com um clique.",
      "Use notas para registrar objetivo, prompt e próximos passos.",
    ],
    command: "codex --workspace .",
  },
  {
    id: "git",
    label: "Git Map",
    title: "Git operacional dentro do workspace",
    summary: "Cortex mostra status, histórico, branches e release info para o repositório ativo.",
    steps: [
      "Abra um workspace com uma pasta que contenha `.git`.",
      "Revise changes, stage, unstage, commit, fetch, pull e push.",
      "Consulte detalhes de commits e branches sem sair do app.",
      "Use a aba Releases para preparar tags e notas de versão.",
    ],
    command: "git status",
  },
  {
    id: "privacy",
    label: "Privacy",
    title: "Modelo local-first",
    summary: "Cortex foi desenhado como ferramenta local, não como serviço remoto.",
    steps: [
      "Sem tracking, analytics, telemetria ou sincronização em cloud.",
      "Sem features de AI ou chamadas externas em segundo plano.",
      "Update check usa GitHub Releases apenas quando você escolhe verificar.",
      "Feedback abre GitHub Issues no navegador e não envia dados automaticamente.",
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
    note: "Refinar landing page, validar build e preparar release.",
    git: "main · 2 files changed",
    output: ["agent: scanning website/src", "task: improve demo + docs", "status: build passing"],
  },
  {
    id: "portfolio",
    name: "Portfolio",
    path: "C:\\Projects\\portfolio",
    agent: "UI Agent",
    command: "npm run dev -- --host 127.0.0.1",
    note: "Comparar hero, loader e navegação com o site pessoal.",
    git: "main · clean",
    output: ["vite: ready in 420ms", "browser: localhost open", "agent: checking visual rhythm"],
  },
  {
    id: "api",
    name: "API Server",
    path: "C:\\Projects\\api-server",
    agent: "Test Agent",
    command: "npm test -- --watch",
    note: "Manter testes rodando enquanto outro agente mexe no frontend.",
    git: "feature/auth · 1 commit ahead",
    output: ["tests: 42 passed", "watch: waiting for changes", "agent: monitoring regressions"],
  },
];

const roadmapItems = [
  "Runtime de terminal mais persistente via tray process local.",
  "Import/export de perfis de workspace.",
  "Templates locais opcionais no Marketplace.",
  "Instalador Windows assinado.",
];

const pages = [
  { id: "home", label: "Home" },
  { id: "demo", label: "Demo" },
  { id: "features", label: "Features" },
  { id: "docs", label: "Docs" },
  { id: "about", label: "About" },
];

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
  return new Intl.DateTimeFormat("pt-BR", {
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
              <div className="snippet">Release v0.1.18</div>
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
        <span>Multi-projeto</span>
        <span>AI agents</span>
        <span>Windows</span>
      </div>
      <h2>Aprenda, rode e organize sem decorar tudo de uma vez.</h2>
    </section>
  );
}

function HomeValue() {
  const cards = [
    {
      title: "Git fica visual",
      text: "Veja mudanças, branches e commits em uma interface clara. Aprenda o fluxo antes de decorar comandos.",
    },
    {
      title: "Agentes sem bagunça",
      text: "Rode Codex, testes e servidores em panes separados. Cada processo fica no projeto certo.",
    },
    {
      title: "Projetos separados",
      text: "Caminhos, notas, comandos e histórico ficam salvos por workspace. Nada se mistura.",
    },
  ];

  return (
    <section className="homeValue">
      <div className="homeValueHeader">
        <span className="sectionEyebrow">Why Cortex</span>
        <h2>Feito para aprender, criar e rodar vários fluxos ao mesmo tempo.</h2>
        <p>
          Um terminal comum executa comandos. Cortex organiza o projeto inteiro: Git, agentes,
          notas, histórico e comandos salvos em uma GUI local.
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
        <h2>Troque de projeto sem perder o agente certo.</h2>
        <p>
          Clique em um workspace e veja como terminal, Git, notas e comandos mudam juntos.
          A ideia é simples: cada projeto carrega seu próprio contexto operacional.
        </p>
      </div>

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
      tabs: ["Overview", "Changes", "History", "Releases"],
      body: ["main · clean", "v0.1.18 ready", "3 commits ahead"],
      terminal: "git push origin main",
    },
    privacy: {
      title: "Local-first",
      tabs: ["App data", "No telemetry", "Manual update"],
      body: ["No analytics", "No cloud sync", "No background API"],
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
            <p>Guia rápido para usar Cortex como terminal multi-projeto e painel local para agentes.</p>
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
              <h4>Como funciona</h4>
              <ol>
                {activeDoc.steps.map(step => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>

            <section className="docsBlock commandBlock">
              <h4>Comando exemplo</h4>
              <pre>{activeDoc.command}</pre>
            </section>
          </div>

          <DocScreenshot activeId={activeDoc.id} />

          <section className="docsNote">
            <strong>Modelo mental</strong>
            <p>
              Pense no Cortex como uma GUI local para alternar entre projetos, manter agentes rodando
              em paralelo e preservar o contexto que normalmente fica espalhado entre terminal,
              editor, notas e Git.
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
        <h2>Instalador Windows direto das GitHub Releases.</h2>
        <p>
          Cortex ainda é unsigned, então o Microsoft SmartScreen pode pedir confirmação. A página
          lê releases públicas do GitHub e mostra o instalador mais recente quando ele existe.
        </p>
      </div>

      <div className="releasePanel">
        {status === "loading" && <div className="releaseState">Sincronizando releases...</div>}
        {status === "error" && (
          <div className="releaseState">
            Não consegui ler a API agora. <a href={releaseUrl}>Abrir GitHub Releases</a>
          </div>
        )}
        {status === "ready" && !latest && (
          <div className="releaseState">
            Ainda não há releases públicas. <a href={releaseUrl}>Abrir página de releases</a>
          </div>
        )}
        {latest && (
          <>
            <article className="latestRelease">
              <div>
                <span className="releaseBadge">Latest</span>
                <h3>{latest.name || latest.tag_name}</h3>
                <p>{latest.published_at ? formatDate(latest.published_at) : "Release sem data publicada"}</p>
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
                    <b>Baixar</b>
                  </a>
                ))
              ) : (
                <div className="releaseState compact">
                  Esta release não tem `.exe`, `.msi`, `.msix` ou `.zip`. <a href={latest.html_url}>Abrir release</a>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {releases.length > 1 && (
        <div className="releaseArchive">
          <h3>Versões anteriores</h3>
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
          <h2>Apoie o desenvolvimento local-first do Cortex.</h2>
          <p>
            Se o Cortex economiza tempo no seu setup diário, você pode apoiar o projeto sem colocar
            pagamentos, popups ou tracking dentro do app.
          </p>
          <a className="button coffeeButton" href={coffeeUrl}>
            Buy Me a Coffee
          </a>
        </article>

        <article className="supportPanel aboutPanel">
          <span className="panelKicker">About me</span>
          <h2>Feito por Julius Otto.</h2>
          <p>
            Desenvolvo ferramentas locais, interfaces desktop e produtos pequenos que reduzem atrito
            em workflows reais. O portfólio reúne projetos, contato e trabalhos recentes.
          </p>
          <div className="aboutLinks">
            <a href={portfolioUrl}>Portfólio</a>
            <a href={repositoryUrl}>GitHub repo</a>
          </div>
        </article>
      </div>
    </section>
  );
}

export function App() {
  const [introDone, setIntroDone] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [activePage, setActivePage] = useState(() => {
    const hash = window.location.hash.replace("#", "");
    return pages.some(page => page.id === hash) || hash === "download" ? hash : "home";
  });

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
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (pages.some(page => page.id === hash) || hash === "download") {
        setActivePage(hash);
      }
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function selectPage(pageId) {
    setActivePage(pageId);
    window.history.pushState(null, "", `#${pageId}`);
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
                {/* <p className="lead heroPunch">Git visual. Projetos claros. Agentes organizados.</p> */}
                {/* <div className="heroActions">
                  <button className="button primary" onClick={() => selectPage("download")} type="button">
                    Baixar para Windows
                  </button>
                  <a className="button secondary" href={repositoryUrl}>
                    Ver no GitHub
                  </a>
                </div> */}
                {/* <p className="heroTrust">Grátis, open source e local-first.</p> */}
                <div className="heroMeta" aria-label="Cortex quick facts">
                  {/* <span>produtividade expandida</span>
                  <span>Open Source</span>
                  <span>Sem telemetria</span>
                  <span>seus dados 100% na sua maquina</span> */}
                </div>
              </div>
            </section>

            <section className="postHero" aria-label="Cortex overview">
              <div className="postHeroHeader">
                <span className="sectionEyebrow">Por que Cortex</span>
                <h2>Terminal, Git e agentes no mesmo contexto.</h2>
              </div>
              <div className="postHeroGrid">
                <article>
                  <span>01</span>
                  <h3>Aprenda Git sem medo</h3>
                  <p>Veja arquivos alterados, branches, commits e releases em uma interface visual. Você entende o fluxo antes de decorar cada comando.</p>
                </article>
                <article>
                  <span>02</span>
                  <h3>Um painel para cada projeto</h3>
                  <p>Cada workspace guarda caminho, terminais, notas, histórico, comandos salvos e layout. Trocar de projeto não mistura contexto.</p>
                </article>
                <article>
                  <span>03</span>
                  <h3>Rode agentes em paralelo</h3>
                  <p>Use panes para Codex, servidores, testes e scripts ao mesmo tempo. Você sabe qual agente pertence a qual projeto e tarefa.</p>
                </article>
              </div>
              <div className="postHeroFlow">
                <div>
                  <strong>Fluxo real</strong>
                  <p>Abra o projeto, rode o agente, acompanhe Git, anote decisões e volte amanhã exatamente no mesmo workspace.</p>
                </div>
                <button className="button primary" onClick={() => selectPage("download")} type="button">
                  Baixar para Windows
                </button>
              </div>
            </section>
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
                  <h2>Do terminal ao release sem perder o contexto.</h2>
                  <p>
                    Cortex não substitui Git, shell ou editor. Ele organiza o entorno: caminho certo,
                    abas certas, comandos recorrentes e contexto de release sempre no mesmo workspace.
                  </p>
                </div>
                <ol className="workflowSteps">
                  <li>Abra o workspace e restaure layout, terminal, notas e Git Map.</li>
                  <li>Rode comandos salvos ou recentes pela Command Palette.</li>
                  <li>Revise status, commits, branches e release info pelo Git Map.</li>
                  <li>Publique a versão usando seu fluxo local e GitHub Releases.</li>
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
                <h2>Próximos passos com a mesma regra: local primeiro.</h2>
              </div>
              <ul>
                {roadmapItems.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </>
        )}

        {activePage === "docs" && <Documentation />}
        {activePage === "download" && <DownloadCenter />}
        {activePage === "about" && <SupportAndAbout />}
      </div>
    </main>
  );
}
