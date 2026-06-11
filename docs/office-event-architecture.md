# Office View event architecture

## Data flow

The Office View now uses this pipeline:

```text
Structured adapters      Terminal fallback
        |                      |
        +---- AgentEventEnvelope ----+
                                      |
                               Agent event bus
                                      |
                              Agent state machine
                                      |
                                AgentSnapshot
                                      |
                    Existing Pixi characters and rooms
```

Adapters report observations. They do not create visual state directly. The state machine is the only owner of accepted activity, location, confidence, and goal.

## Event contract

`AgentEvent` contains the domain event. `AgentEventEnvelope` adds agent identity, timestamp, source, confidence, optional goal, and independent activity/location observations.

Sources are:

- `structured`: provider-owned records such as Claude JSONL.
- `heuristic`: terminal text used only when no structured source covers the agent.

Structured observations take precedence for five minutes. Terminal fallback cannot overwrite an agent with recent structured evidence.
When structured coverage appears after a heuristic agent already exists, the state machine retires the covered heuristic representation to prevent duplicate characters.

## State machine

`AgentState` separates:

- activity: `coding`, `researching`, `reviewing`, `waiting_input`, `waiting_approval`, `completed`, or `idle`;
- location: `desk`, `library`, `meeting`, `buildlab`, or `lounge`;
- confidence and optional `currentGoal`.

Adapters may suggest activity and location independently. The state machine does not contain an activity-to-room table. The visual model converts accepted locations to the existing Pixi scene anchors.

Transitions use 15-second hysteresis. A different observation becomes pending and is accepted only if it is not contradicted during that window and the current state has also existed for at least 15 seconds. Goal and event metadata may update without moving the character.

Subagents require structured evidence. They expire after five minutes without a supporting event and then use the existing exit animation.

## Confidence

Confidence is displayed on each character and in its event panel:

- `>= 0.8`: confirmed;
- `>= 0.5`: inferred;
- `< 0.5`: unknown.

Claude structured events currently emit high confidence. Terminal fallback emits low confidence and therefore remains visibly uncertain.

## Migration plan

1. Keep terminal parsing as fallback while provider adapters are added.
2. Add structured adapters for Codex and Gemini when stable local event/session formats are available.
3. Publish native runtime events directly into `agentEventBus.ts` for approval and input requests where provider APIs expose them.
4. Remove the corresponding terminal patterns after each provider reaches structured coverage.
5. Persist event history only if replay across application restarts becomes necessary. Current events remain in memory, matching previous Office View behavior.

## File ownership

- `officeTypes.ts`: event, state, envelope, snapshot, and visual compatibility types.
- `agentEventBus.ts`: central publish/subscribe API and event history.
- `agentStateMachine.ts`: source precedence, hysteresis, confidence ownership, and subagent TTL.
- `adapters/claudeJsonlAdapter.ts`: structured Claude event emission.
- `adapters/terminalOutputAgentAdapter.ts`: low-confidence fallback without subagent creation.
- `officeModel.ts`: projection from accepted state to existing character pose and scene zone.
- `OfficeView.tsx`: adapter polling, event publication, and rendering orchestration.
