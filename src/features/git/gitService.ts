import { invoke } from "@tauri-apps/api/core";
import type {
  GitBranchesSnapshot,
  GitCommitInfo,
  GitOverview,
  GitReleaseInfo,
  GitReleaseOptions,
  GitStatusSnapshot,
} from "@/features/git/gitTypes";

export const gitService = {
  detectRepo(path: string) {
    return invoke<boolean>("git_detect_repo", { path });
  },
  getOverview(path: string) {
    return invoke<GitOverview>("git_get_overview", { path });
  },
  getStatus(path: string) {
    return invoke<GitStatusSnapshot>("git_get_status", { path });
  },
  stageFile(path: string, file: string) {
    return invoke("git_stage_file", { path, file });
  },
  unstageFile(path: string, file: string) {
    return invoke("git_unstage_file", { path, file });
  },
  stageAll(path: string) {
    return invoke("git_stage_all", { path });
  },
  unstageAll(path: string) {
    return invoke("git_unstage_all", { path });
  },
  discardFile(path: string, file: string) {
    return invoke("git_discard_file", { path, file });
  },
  commit(path: string, message: string) {
    return invoke("git_commit", { path, message });
  },
  push(path: string) {
    return invoke("git_push", { path });
  },
  pull(path: string) {
    return invoke("git_pull", { path });
  },
  fetch(path: string) {
    return invoke("git_fetch", { path });
  },
  getHistory(path: string, limit = 50) {
    return invoke<GitCommitInfo[]>("git_get_history", { path, limit });
  },
  getCommitDetails(path: string, hash: string) {
    return invoke<GitCommitInfo>("git_get_commit_details", { path, hash });
  },
  getBranches(path: string) {
    return invoke<GitBranchesSnapshot>("git_get_branches", { path });
  },
  createBranch(path: string, name: string) {
    return invoke("git_create_branch", { path, name });
  },
  switchBranch(path: string, name: string) {
    return invoke("git_switch_branch", { path, name });
  },
  deleteBranch(path: string, name: string) {
    return invoke("git_delete_branch", { path, name });
  },
  getReleaseInfo(path: string) {
    return invoke<GitReleaseInfo>("git_get_release_info", { path });
  },
  createRelease(path: string, version: string, notes: string, options: GitReleaseOptions) {
    return invoke("git_create_release", { path, version, notes, options });
  },
};
