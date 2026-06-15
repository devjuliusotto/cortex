export type GitCommitInfo = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
};

export type GitOverview = {
  isRepo: boolean;
  root: string | null;
  currentBranch: string | null;
  remoteName: string | null;
  remoteUrl: string | null;
  clean: boolean;
  modifiedCount: number;
  stagedCount: number;
  untrackedCount: number;
  ahead: number;
  behind: number;
  latestCommit: GitCommitInfo | null;
  refreshedAt: string;
};

export type GitFileChange = {
  path: string;
  originalPath: string | null;
  status: "Modified" | "Added" | "Deleted" | "Renamed" | "Untracked" | string;
  staged: boolean;
};

export type GitStatusSnapshot = {
  isRepo: boolean;
  root: string | null;
  files: GitFileChange[];
  stagedCount: number;
  modifiedCount: number;
  untrackedCount: number;
};

export type GitBranchInfo = {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
  upstream: string | null;
  lastCommit: string;
};

export type GitBranchesSnapshot = {
  isRepo: boolean;
  currentBranch: string | null;
  dirty: boolean;
  local: GitBranchInfo[];
  remote: GitBranchInfo[];
};

export type GitMergePreview = {
  currentBranch: string;
  sourceBranch: string;
  dirty: boolean;
  canFastForward: boolean;
  commits: GitCommitInfo[];
  files: string[];
};

export type GitStashInfo = {
  index: number;
  reference: string;
  message: string;
  date: string;
};

export type GitStashDetails = {
  stash: GitStashInfo;
  files: string[];
  patch: string;
};

export type GitBlameLine = {
  lineNumber: number;
  hash: string;
  shortHash: string;
  author: string;
  authorTime: number;
  summary: string;
  content: string;
};

export type GitBlameSnapshot = {
  file: string;
  lines: GitBlameLine[];
};

export type GitReleaseInfo = {
  isRepo: boolean;
  currentBranch: string | null;
  clean: boolean;
  packageVersion: string | null;
  tauriVersion: string | null;
  cargoVersion: string | null;
  latestTag: string | null;
};

export type GitReleaseOptions = {
  updatePackageJson: boolean;
  updateTauriConf: boolean;
  updateCargoToml: boolean;
  commitChanges: boolean;
  createGitTag: boolean;
  pushBranch: boolean;
  pushTag: boolean;
};

export type GitMapTab = "overview" | "changes" | "history" | "branches" | "merge" | "stashes" | "blame" | "releases";
