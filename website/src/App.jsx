import React, { Suspense, lazy, useEffect, useState } from "react";

const CortexScene = lazy(() =>
  import("./CortexScene.jsx").then(module => ({ default: module.CortexScene })),
);

const releaseUrl = "https://github.com/devjuliusotto/cortex/releases";
const releasesApiUrl = "https://api.github.com/repos/devjuliusotto/cortex/releases";

const imageExtensions = ["png", "jpg", "jpeg", "webp"];
const videoSources = ["/media/video-geral.webm", "/media/video-geral.mp4", "/media/cortex-overview.webm", "/media/cortex-overview.mp4"];

const features = [
  {
    title: "Workspaces reais",
    text: "Cada projeto guarda caminho padrão, sessões, layout, snippets, notas e preferências locais.",
  },
  {
    title: "Terminais persistentes",
    text: "PowerShell, CMD e WSL ficam organizados por workspace, com panes e histórico de contexto.",
  },
  {
    title: "Local-first",
    text: "Sem telemetria, analytics, cloud sync ou chamadas externas em segundo plano.",
  },
];

const metrics = [
  ["Windows", "primeiro alvo"],
  ["0", "telemetria"],
  ["Local", "estado do app"],
  ["Tauri", "desktop runtime"],
];

const gallery = [1, 2, 3, 4, 5].map(number => ({
  title: `Cortex ${number}`,
  sources: imageExtensions.map(extension => `/media/${number}.${extension}`),
  description: "Imagem real do produto. Substitua pelo screenshot correspondente em website/public/media.",
}));

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
            <small>4 workspace items · Workspace path: C:\Projects\Cortex</small>
          </div>
          <div className="mockActions">
            <span>app data</span>
            <span>no telemetry</span>
          </div>
        </div>
        <div className="mockTerminalGrid">
          <div className="mockTerminal">
            <div className="mockTabs">
              <span className="on">PowerShell</span>
              <span>Notes</span>
              <span>Snippets</span>
            </div>
            <pre>{`PS C:\\Projects\\Cortex> npm run tauri:dev
ready in 486ms

workspace loaded
terminal restored
layout synchronized`}</pre>
          </div>
          {!compact && (
            <div className="mockPanel">
              <span className="panelTitle">Workspace notes</span>
              <p>Release checklist, build commands and project-specific context stay beside the terminal.</p>
              <div className="snippet">npm run build</div>
              <div className="snippet">cargo check</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MediaShowcase() {
  const videoSrc = useFirstAvailable(videoSources);

  return (
    <section className="section mediaSection" id="demo">
      <div className="sectionEyebrow">Product demo</div>
      <div className="sectionHeader">
        <h2>Vídeo, screenshots reais e uma narrativa de produto completa.</h2>
        <p>
          Coloque <code>video-geral.mp4</code> e imagens <code>1</code> a <code>5</code> em
          <code> website/public/media</code>. O site detecta os arquivos automaticamente.
        </p>
      </div>

      <div className="videoFrame">
        {videoSrc ? (
          <video controls playsInline poster="/media/workspace-terminal.jpg" src={videoSrc} />
        ) : (
          <div className="videoFallback">
            <AppMockup compact />
            <p>Coloque o vídeo como <code>video-geral.mp4</code> ou <code>video-geral.webm</code>.</p>
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
        <h2>Instalador sempre atualizado direto das GitHub Releases.</h2>
        <p>
          Quando você publicar uma nova release com executáveis no GitHub, esta seção atualiza
          sozinha. As versões antigas continuam disponíveis no histórico abaixo.
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
          <a href="#download">Download</a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="heroText">
          <p className="kicker">Local-first · Windows desktop · terminal workspace</p>
          <h1>Cortex organiza seus projetos sem tirar você do terminal.</h1>
          <p className="lead">
            Um app desktop para manter workspaces, PowerShell, CMD, WSL, notas, snippets e
            layouts persistentes no mesmo lugar.
          </p>
          <div className="heroActions">
            <a className="button primary" href="#download">
              Baixar para Windows
            </a>
            <a className="button secondary" href="#demo">
              Ver demo
            </a>
          </div>
        </div>
        <div className="heroVisual" aria-hidden="true">
          <AppMockup />
        </div>
        <a className="scrollCue" href="#demo" aria-label="Scroll to demo" />
      </section>

      <section className="section introStrip">
        <div>
          <span className="sectionEyebrow">Why Cortex</span>
          <h2>Feito para quem abre vários projetos e precisa recuperar o contexto rápido.</h2>
        </div>
        <p>
          Cortex não tenta virar cloud, rede social ou dashboard pesado. Ele foca no básico que
          incomoda todo dia: sessão local, caminho certo, terminal certo e comandos recorrentes.
        </p>
      </section>

      <MediaShowcase />

      <section className="section featureGrid" id="features">
        {features.map(feature => (
          <article className="feature" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>

      <section className="section stats">
        {metrics.map(([value, label]) => (
          <div className="stat" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <DownloadCenter />
    </main>
  );
}
