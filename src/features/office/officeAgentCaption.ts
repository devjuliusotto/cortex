import type { AgentActivity, OfficeAgentModel, OfficeZoneId } from "./officeTypes";

const activityCaptions: Record<AgentActivity, string[]> = {
  coding: ["Working", "Writing some code", "Making things happen", "In the flow"],
  researching: ["Doing some research", "Checking the library", "Looking for answers", "Reading the docs"],
  reviewing: ["Reviewing the work", "Double-checking things", "Inspecting the results", "Quality check"],
  waiting_input: ["Let's sync up", "Waiting for your input", "Quick question for you"],
  waiting_approval: ["Approval needed", "Ready when you are", "Waiting for the green light"],
  completed: ["All done", "Task complete", "Nice, that worked", "Wrapping things up"],
  idle: ["Let's have a Coffee Break", "Taking a short break", "Recharging", "Back in a moment"],
};

const zoneCaptions: Partial<Record<OfficeZoneId, string[]>> = {
  buildLab: ["Watching the build", "Build in progress", "Checking the pipeline"],
  testBoard: ["Running the tests", "Testing everything", "Checking the test suite"],
  debugCorner: ["Hunting down a bug", "Debugging", "Following the clues"],
  gitBoard: ["Checking the branch", "Reviewing Git changes", "Keeping Git tidy"],
  meetingRoom: ["Team sync", "Talking it through", "Planning the next move"],
  researchLibrary: ["Reading the docs", "Research mode", "Looking for answers"],
  lounge: ["Let's have a Coffee Break", "Taking a short break", "Coffee first"],
  bossDesk: ["Waiting for the green light", "Ready for approval", "Checking in with you"],
};

const roomNames: Record<OfficeZoneId, string> = {
  bossDesk: "Mission Control",
  codingDesks: "Work Area",
  researchLibrary: "Library",
  buildLab: "Build Lab",
  testBoard: "Test Board",
  debugCorner: "Debug Corner",
  gitBoard: "Git Board",
  lounge: "Pause Area",
  meetingRoom: "Meeting Room",
  entrance: "Office",
};

export function officeAgentCaption(agent: OfficeAgentModel, moving = false) {
  if (agent.phase === "exiting") {
    return "Wrapping things up";
  }
  if (moving) {
    return `Heading to ${roomNames[agent.zone]}`;
  }

  const captions = zoneCaptions[agent.zone] ?? activityCaptions[agent.activity];
  return captions[captionIndex(`${agent.id}:${agent.activity}:${agent.zone}`, captions.length)];
}

function captionIndex(value: string, length: number) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % length;
}
