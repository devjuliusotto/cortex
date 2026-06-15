import { invoke } from "@tauri-apps/api/core";
import type {
  GitBranchesSnapshot,
  GitBlameSnapshot,
  GitCommitInfo,
  GitMergePreview,
  GitOverview,
  GitReleaseInfo,
  GitReleaseOptions,
  GitStatusSnapshot,
  GitStashDetails,
  GitStashInfo,
} from "@/features/git/gitTypes";

export const gitService = {
  detectRepo(path: string) {
    return invoke<boolean>("git_detect_repo", { path });
  },
  initRepo(path: string) {
    return invoke("git_init_repo", { path });
  },
  setOrigin(path: string, url: string) {
    return invoke("git_set_origin", { path, url });
  },
  getOverview(path: string) {
    return invoke<GitOverview>("git_get_overview", { path });
  },
  getStatus(path: string) {
    return invoke<GitStatusSnapshot>("git_get_status", { path });
  },
  watchStart(path: string) {
    return invoke<string>("git_watch_start", { path });
  },
  watchStop(root: string) {
    return invoke("git_watch_stop", { root });
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
  previewMerge(path: string, sourceBranch: string) {
    return invoke<GitMergePreview>("git_preview_merge", { path, sourceBranch });
  },
  mergeBranch(path: string, sourceBranch: string) {
    return invoke("git_merge_branch", { path, sourceBranch });
  },
  getStashes(path: string) {
    return invoke<GitStashInfo[]>("git_get_stashes", { path });
  },
  getStashDetails(path: string, index: number) {
    return invoke<GitStashDetails>("git_get_stash_details", { path, index });
  },
  createStash(path: string, message: string, includeUntracked: boolean) {
    return invoke("git_create_stash", { path, message, includeUntracked });
  },
  applyStash(path: string, index: number) {
    return invoke("git_apply_stash", { path, index });
  },
  dropStash(path: string, index: number) {
    return invoke("git_drop_stash", { path, index });
  },
  getTrackedFiles(path: string) {
    return invoke<string[]>("git_get_tracked_files", { path });
  },
  getBlame(path: string, file: string) {
    return invoke<GitBlameSnapshot>("git_get_blame", { path, file });
  },
  getReleaseInfo(path: string) {
    return invoke<GitReleaseInfo>("git_get_release_info", { path });
  },
  createRelease(path: string, version: string, notes: string, options: GitReleaseOptions) {
    return invoke("git_create_release", { path, version, notes, options });
  },
};
