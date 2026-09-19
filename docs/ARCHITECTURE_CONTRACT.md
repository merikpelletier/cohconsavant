# Architecture Contract — Story Blocks Simulation Engine

> **This document is permanent and authoritative.** It records the finalized
> architecture for the Story Blocks simulation engine. Every implementation
> step must remain consistent with this contract. Any proposed deviation must
> be explicitly identified and approved before implementation.

---

## 1. Purpose of the System

Story Blocks is transitioning from **narrative-first generation** to a
**state-driven narrative simulation**.

The world is modeled as an independent simulation that evolves through
character actions, delayed consequences, and information propagation. The
narrative layer (Story Blocks) observes and dramatizes the simulation's
state — it does not own world continuity.

---

## 2. The Finalized Five Spheres

| # | Sphere | Role |
|---|-------|------|
| 1 | **Objective Registry** | The current factual truth of the world: locations, characters, assets, physical relationships, and the simulation clock. |
| 2 | **Active Situations** | Persistent, evolving processes (debts, investigations, threats) that have their own escalation and resolution logic. They persist independently of whether they appear in a Story Block. |
| 3 | **Subjective Interpretation** | Character-specific perception: beliefs, goals, intentions, and emotional states. Character beliefs may differ from objective truth. |
| 4 | **Socially Distributed Information** | The transmission network: claims, rumours, reputation, and public sentiment — tracking how information flows and mutates between characters and groups. |
| 5 | **Narrative Director** | The reader/orchestrator that evaluates the simulation state and selects which consequences are most valuable to dramatize. It reads state but does not own world continuity. |

---

## 3. Cross-Sphere Systems

These systems operate *across* the spheres and are not contained within any
single sphere:

| System | Responsibility |
|--------|---------------|
| **Character Action** | A cross-sphere transaction initiated by a character. It is **not** an Active Situation. It bridges a character's intention and an objective consequence. |
| **Action Resolver** | Validates physical/temporal preconditions, resolves success/failure/interruption, identifies immediate witnesses, generates objective state changes, creates Observation records, and updates directly affected Active Situations. Handles **direct, immediate** consequences only. |
| **State Change & Consequence** | The transaction log produced by resolved actions. State Change records objective mutations; Consequence records the impact on Active Situations. |
| **Observation** | A record that a witness perceived an action or its result. An observation creates **private knowledge** for the witness — it does **not** automatically become socially distributed. |
| **Information Network Resolver** | Operates separately from the Action Resolver and may run during **later** simulation ticks. Determines whether an observation is understood, what belief it creates, whether and when the character communicates it, who receives it, how the claim mutates, whether it becomes a rumour, and whether it affects reputation. Handles **delayed** discovery, communication, claim mutation, rumours, and reputation. |
| **Simulation Tick** | Orchestrates both resolvers and the advance of time. It does not collapse their responsibilities into one operation. |

---

## 4. Responsibility Boundaries

1. **CharacterAction is not an ActiveSituation.** It is a cross-sphere transaction that may affect one or several Active Situations but is not itself a persistent situation.
2. **The Action Resolver handles direct physical and immediate consequences only.** It does not process delayed discovery, communication, or social propagation.
3. **The Information Network Resolver handles delayed discovery, communication, claim mutation, rumours, and reputation.** It operates on Observation records and may run ticks after the action was resolved.
4. **The Narrative Director reads the simulation state but does not own world continuity.** It selects and dramatizes; it does not mutate objective truth.
5. **Active Situations persist independently of whether they are shown in a Story Block.** The simulation runs even when the narrative camera is elsewhere.
6. **The Objective Registry contains the current factual truth.** It is the single source of "what actually happened."
7. **Character beliefs may differ from that truth.** The Subjective sphere is allowed to be wrong; this is a feature, not a bug.

---

## 5. The Action Lifecycle

```
1. Action Proposal      — A character forms an intention based on goals, beliefs, and current pressures.
2. Preconditions Check — The system verifies location, time, access, assets, witnesses, and physical constraints.
3. Action Resolution    — The system determines success, partial success, failure, or interruption.
4. Objective Changes    — Objects move, access changes, characters relocate, evidence is created or removed.
5. Situation Updates    — Relevant Active Situations advance, regress, escalate, branch, or remain unchanged.
6. Subjective Updates   — The actor and witnesses gain knowledge, revise beliefs, and experience emotional changes.
7. Information Propagation — Only communicated observations become claims, rumours, or public knowledge.
8. Narrative Evaluation — The Director evaluates the resulting state and selects which consequence is most valuable to dramatize next.
```

---

## 6. The Simulation Tick

The Simulation Tick orchestrates both resolvers while keeping them
independent:

```
1. Generate proposed character actions.
2. Resolve executable actions.            ← Action Resolver
3. Apply objective and situation changes. ← Action Resolver
4. Create observations and subjective updates. ← Action Resolver
5. Process eligible information transmissions. ← Information Network Resolver
6. Advance time and active pressures.
7. Let the Narrative Director evaluate the resulting state.
```

---

## 7. Phase 1 Exclusion Rule

> **Anything excluded from the prototype is deferred, not removed from the
> architecture.**

Phase 1 tests simulation integrity through a controlled Subura scenario
(Aelia steals the grain merchant's ledger). The following are **deferred** for
Phase 1 but remain in the architecture:

| Deferred | Reason |
|----------|--------|
| Routine | Starting positions are initialized manually. |
| Rumour (as distinct from Claim) | Phase 1 only needs to reach the first private claim transmission. |
| Narrative Director | Phase 1 tests simulation integrity, not Story Block selection. |
| Group / Faction | Phase 1 operates at the individual character level. |
| Reputation / PublicSentiment | Phase 1 does not need aggregated social sentiment. |
| DynamicRelationshipState | Phase 1 uses static relationships. |
| Pressure / Deadline / EscalationStage / ResolutionCondition as separate entities | Phase 1 models these as fields within ActiveSituation. |

**WorldTime is NOT deferred.** Delayed discovery and delayed communication
require at least a minimal simulation clock / tick timestamp.

---

## 8. Phase 1 Entity Set (Approved)

| Sphere | Entities |
|--------|----------|
| Objective Registry | Character, Location, Asset, WorldTime |
| Active Situations | ActiveSituation |
| Subjective & Social | Observation, Belief, Claim, InformationTransmission |
| Cross-sphere | CharacterAction, StateChange, Consequence |
| Systems (logic, not entities) | Action Resolver, Information Network Resolver, Simulation Tick |

---

## 9. Implementation Discipline

At the beginning and end of every implementation step, restate:
- the current Phase 1 objective;
- which architectural responsibilities are being implemented;
- which responsibilities remain deliberately deferred;
- whether any proposed change conflicts with this Architecture Contract.

Do not expand the scope, rename the architectural responsibilities, or move
entities between spheres without explicitly identifying the change and
obtaining approval.