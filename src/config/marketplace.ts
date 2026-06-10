export const GITHUB_REPOSITORY = {
  owner: "devjuliusotto",
  name: "cortex",
} as const;

export const GITHUB_ISSUE_URL = `https://github.com/${GITHUB_REPOSITORY.owner}/${GITHUB_REPOSITORY.name}/issues/new`;

// TODO: Replace this build-time flag when Marketplace add-on enable/disable state exists.
export const OFFICE_VIEW_ADDON_ENABLED = true;

export type FeedbackType = "bug" | "feature" | "template" | "feedback";

export const FEEDBACK_TYPES: Record<
  FeedbackType,
  { label: string; titlePrefix: string; labels: string[] }
> = {
  bug: {
    label: "Bug report",
    titlePrefix: "[Bug]",
    labels: ["bug"],
  },
  feature: {
    label: "Feature request",
    titlePrefix: "[Feature]",
    labels: ["enhancement"],
  },
  template: {
    label: "Template/add-on request",
    titlePrefix: "[Template]",
    labels: ["template", "enhancement"],
  },
  feedback: {
    label: "General feedback",
    titlePrefix: "[Feedback]",
    labels: ["feedback"],
  },
};
