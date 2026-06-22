export type DeveloperToolCategory =
  | "Essentials"
  | "Languages"
  | "IDEs"
  | "Databases"
  | "Cloud & DevOps";

export type DeveloperTool = {
  id: string;
  name: string;
  description: string;
  category: DeveloperToolCategory;
  tags: string[];
};

// Cortex intentionally stores only stable WinGet package IDs. Versions, download URLs,
// architectures, hashes, and installer switches are resolved by the WinGet source.
export const developerToolsCatalog: DeveloperTool[] = [
  { id: "Git.Git", name: "Git", description: "Distributed version control and Git command-line tools.", category: "Essentials", tags: ["git", "source control"] },
  { id: "GitHub.cli", name: "GitHub CLI", description: "Pull requests, issues, releases, and workflows from the terminal.", category: "Essentials", tags: ["github", "gh"] },
  { id: "Microsoft.PowerShell", name: "PowerShell", description: "Modern cross-platform shell and automation environment.", category: "Essentials", tags: ["shell", "automation"] },
  { id: "7zip.7zip", name: "7-Zip", description: "File archiver used by many developer workflows.", category: "Essentials", tags: ["archive", "utilities"] },
  { id: "OpenJS.NodeJS.LTS", name: "Node.js LTS", description: "Long-term support Node.js runtime with npm.", category: "Languages", tags: ["javascript", "typescript", "npm", "lts"] },
  { id: "Python.Python.3.13", name: "Python 3.13", description: "Python runtime and standard development tools on the 3.13 release channel.", category: "Languages", tags: ["python", "pip"] },
  { id: "EclipseAdoptium.Temurin.21.JDK", name: "Temurin JDK 21", description: "OpenJDK distribution on the Java 21 LTS release channel.", category: "Languages", tags: ["java", "jdk", "lts"] },
  { id: "GoLang.Go", name: "Go", description: "Go compiler and standard toolchain.", category: "Languages", tags: ["golang", "compiler"] },
  { id: "Rustlang.Rustup", name: "Rustup", description: "Rust toolchain installer and update manager.", category: "Languages", tags: ["rust", "cargo"] },
  { id: "Microsoft.DotNet.SDK.8", name: ".NET SDK 8", description: ".NET SDK on the 8 LTS release channel.", category: "Languages", tags: ["dotnet", "csharp", "lts"] },
  { id: "Microsoft.VisualStudioCode", name: "Visual Studio Code", description: "Extensible source-code editor from Microsoft.", category: "IDEs", tags: ["editor", "vscode"] },
  { id: "JetBrains.IntelliJIDEA.Community", name: "IntelliJ IDEA Community", description: "JetBrains IDE for Java and JVM development.", category: "IDEs", tags: ["java", "jetbrains"] },
  { id: "Postman.Postman", name: "Postman", description: "API development, testing, and collaboration client.", category: "IDEs", tags: ["api", "http"] },
  { id: "MongoDB.Compass.Full", name: "MongoDB Compass", description: "Official visual client for MongoDB databases.", category: "Databases", tags: ["mongodb", "nosql", "database"] },
  { id: "Oracle.MySQLWorkbench", name: "MySQL Workbench", description: "Visual database design and administration for MySQL.", category: "Databases", tags: ["mysql", "sql"] },
  { id: "Docker.DockerDesktop", name: "Docker Desktop", description: "Local container runtime and Docker developer tooling.", category: "Cloud & DevOps", tags: ["docker", "containers"] },
  { id: "Kubernetes.kubectl", name: "kubectl", description: "Official Kubernetes command-line client.", category: "Cloud & DevOps", tags: ["kubernetes", "k8s"] },
  { id: "Amazon.AWSCLI", name: "AWS CLI", description: "Official command-line interface for Amazon Web Services.", category: "Cloud & DevOps", tags: ["aws", "cloud"] },
  { id: "Microsoft.AzureCLI", name: "Azure CLI", description: "Official command-line interface for Microsoft Azure.", category: "Cloud & DevOps", tags: ["azure", "cloud"] },
];

export const developerToolCategories = [
  "All",
  "Essentials",
  "Languages",
  "IDEs",
  "Databases",
  "Cloud & DevOps",
] as const;

const commonFlags = "--exact --source winget --accept-package-agreements --accept-source-agreements";

export function installDeveloperToolCommand(packageId: string) {
  return `winget install --id ${packageId} ${commonFlags}`;
}

export function updateDeveloperToolCommand(packageId: string) {
  return `winget upgrade --id ${packageId} ${commonFlags}`;
}

export const checkDeveloperToolUpdatesCommand = "winget source update; winget upgrade --source winget";
export const updateAllDeveloperToolsCommand = "winget source update; winget upgrade --all --source winget --accept-package-agreements --accept-source-agreements";
