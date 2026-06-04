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
    title: "Git Map integrado",
    text: "Status, branches, histórico, detalhes de commits e fluxo de release ficam ao lado do terminal do workspace.",
  },
  {
    title: "Command Palette",
    text: "Ações do workspace, comandos salvos, histórico recente e atalhos de template em um único lugar pesquisável.",
  },
  {
    title: "Layouts persistentes",
    text: "Panes horizontais e verticais, notas, Git Map e terminal voltam do jeito que você deixou.",
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
    label: "Start",
    title: "Instalação e primeiro workspace",
    summary: "Baixe a release mais recente, crie um workspace e defina a pasta padrão do projeto.",
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
    label: "Workspace",
    title: "Workspaces guardam contexto real",
    summary: "Cada workspace controla caminho, cor, auto-start, snippets, notas, sessões e layout.",
    steps: [
      "Use o menu lateral para renomear, duplicar, colorir ou remover workspaces.",
      "Ative auto-start para iniciar terminais quando o workspace abrir.",
      "Use notas e snippets para guardar comandos específicos do projeto.",
      "Caminhos inválidos caem para a pasta do usuário com aviso visível.",
    ],
    command: "C:\\Projects\\Cortex",
  },
  {
    id: "terminal",
    label: "Terminal",
    title: "Terminal persistente sem cloud",
    summary: "Sessões guardam cwd, scrollback limitado e associação com panes do workspace.",
    steps: [
      "Crie sessões PowerShell, CMD ou WSL Ubuntu conforme o projeto pede.",
      "Divida o painel para comparar terminal, notas e Git Map.",
      "Arraste os divisores para ajustar a proporção do layout.",
      "O histórico local é podado para evitar crescimento indefinido.",
    ],
    command: "npm run build",
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

const roadmapItems = [
  "Runtime de terminal mais persistente via tray process local.",
  "Import/export de perfis de workspace.",
  "Templates locais opcionais no Marketplace.",
  "Instalador Windows assinado.",
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
        <span>local workspace</span>
        <strong>CORTEX</strong>
      </div>
    </div>
  );
}

function ImpactReveal() {
  return (
    <section className="impactReveal" aria-label="Cortex product statement">
      <div className="impactLine">
        <span>Terminal</span>
        <span>Git Map</span>
        <span>Snippets</span>
        <span>Notas</span>
      </div>
      <h2>Um lugar para voltar ao projeto sem reconstruir o contexto.</h2>
    </section>
  );
}

function MediaShowcase() {
  const videoSrc = useFirstAvailable(videoSources);

  return (
    <section className="section mediaSection" id="demo">
      <div className="sectionEyebrow">Product demo</div>
      <div className="sectionHeader">
        <h2>Terminal, Git, snippets e notas no mesmo fluxo.</h2>
        <p>
          O site usa mídia real quando ela existe em <code>website/public/media</code> e cai para
          uma pré-visualização fiel do app quando ainda falta screenshot ou vídeo.
        </p>
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
    terminal: {
      title: "Split terminal",
      tabs: ["PowerShell", "WSL", "Notes"],
      body: ["Pane A: npm run dev", "Pane B: git status", "Scrollback saved"],
      terminal: "layout synchronized",
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
      <div className="sectionEyebrow">Documentation</div>
      <div className="sectionHeader">
        <h2>Uma aba de documentação para entender Cortex em minutos.</h2>
        <p>
          A estrutura segue o que importa para o usuário: instalar, criar workspace, operar terminal,
          usar Git Map e entender exatamente o que fica local.
        </p>
      </div>

      <div className="docsShell">
        <div className="docTabs" role="tablist" aria-label="Documentation sections">
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
        </div>

        <article
          aria-labelledby={`doc-tab-${activeDoc.id}`}
          className="docPanel"
          id={`doc-panel-${activeDoc.id}`}
          role="tabpanel"
        >
          <div>
            <span className="docLabel">{activeDoc.label}</span>
            <h3>{activeDoc.title}</h3>
            <p>{activeDoc.summary}</p>
          </div>
          <ol>
            {activeDoc.steps.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <DocScreenshot activeId={activeDoc.id} />
          <pre>{activeDoc.command}</pre>
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
  return (
    <main className="siteShell">
      <Suspense fallback={<div className="cortexScene" aria-hidden="true"><div className="sceneFallback" /></div>}>
        <CortexScene />
      </Suspense>

      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#top" aria-label="Cortex home">
          <img src="/cortex-logo.svg" alt="" />
          <span>Cortex</span>
        </a>
        <div className="navLinks">
          <a href="#demo">Demo</a>
          <a href="#features">Features</a>
          <a href="#docs">Docs</a>
          <a href="#download">Download</a>
          <a href="#about">About</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="heroText">
          <p className="kicker">Local-first desktop workspace</p>
          <h1>Bem-vindo ao Cortex.</h1>
          <p className="lead heroPunch">Seu terminal. Seu Git. Seu contexto.</p>
          <div className="heroActions">
            <a className="button primary" href="#download">
              Baixar para Windows
            </a>
            <a className="button secondary" href="#docs">
              Abrir documentação
            </a>
          </div>
          <div className="heroMeta" aria-label="Cortex quick facts">
            <span>Windows-first</span>
            <span>Sem telemetria</span>
            <span>Workspaces locais</span>
          </div>
        </div>
        <div className="heroVisual" aria-hidden="true">
          <Hero3DStage />
        </div>
        <a className="scrollCue" href="#demo" aria-label="Scroll to demo" />
      </section>

      <ImpactReveal />

      <section className="section introStrip">
        <div>
          <span className="sectionEyebrow">Reveal</span>
          <h2>Primeiro impacto simples. Depois, profundidade.</h2>
        </div>
        <p>
          Cortex agora aparece como produto antes de virar documentação: abre com presença visual,
          revela a promessa em poucas palavras e só então mostra Git Map, Command Palette,
          histórico por workspace, releases e comandos salvos.
        </p>
      </section>

      <MediaShowcase />

      <section className="section featureGrid" id="features">
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

      <Documentation />

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

      <DownloadCenter />
      <SupportAndAbout />
    </main>
  );
}
