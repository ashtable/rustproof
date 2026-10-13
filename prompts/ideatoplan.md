# Turn an Idea into a Plan

The following prompt is used to turn an idea or initial mockup specified by the user into a formal set of design documents and an implementation plan for the user to implement using Claude Code.


## Code Locations

- ./ - The rustproof Claude Plugin & rustproof CLI mono-repo (public, Apache 2.0 repo)
- ../rustproof-platform/ - The "rustproof-platform" mono-repo (private repo)  

## Design Docs & Implementation Plan

### Review & Document the Current System

#### (Step 1) - Review the current code
Launch a separate, new sonnet-engineer subagent to explore and summarize the contents of each of the following directories for a subsequent subagent in the ./scratch/ directory:
- ./
- ../rustproof-platform/


#### (Step 2) - Document Current Design
Launch a new sonnet-engineer subagent to:
- Review the output of the (Step 1) subagents, and then document the design of the current system in ./design-docs/current-design.md (delete this file with permission if it exists).
- Make sure that this document is detailed and thorough, but concise. Use plenty of mermaid diagrams to convey architecture and sequences.


### Design the Delta to the Current System

#### (Step 3) - Review the user's request
Launch a new sonnet-engineer subagent to:
- Review the user's request, along with downloading any Claude Design files specified by the user. 
- Conduct any web searches necessary to research the user's request. 
- Then document findings for a subsequent subagent in the ./scratch/ directory.


#### (Step 4) - Design the Delta
Launch a new opus-engineer subagent to:
- Review the output of the (Step 2) and (Step 3) subagents
- Assemble a design for the changes that need to be implemented (within the current mono-repo only) to the current system (as per current-design.md) such that it would implement the user's requested feature(s). 
- Document this design in the ./design-docs/design-delta.md for a subsequent subagent (delete this file with permission if it exists).


#### (Step 5) - Review the Delta
Launch a new opus-engineer subagent to:
- Review the output of the (Step 2), (Step 3) and (Step 4) subagents.
- Assemble a list of recommended revisions to the ./design-docs/design-delta.md within the ./scratch/ directory for a subsequent subagent.


#### (Step 6) - Review the Recommended Revisions
Launch a new sonnet-engineer subagent to:
- Review the output of the (Step 2), (Step 3), (Step 4) and (Step 5) subagents.
- Then determine which of the recommended revisions to the ./design-docs/design-delta.md from (Step 5) are actually valid.


#### (Step 7) - Review the Recommended Revisions
Launch a new sonnet-engineer subagent to:
- Review the output of the (Step 2), (Step 3), (Step 4) and (Step 5) subagents. 
- Then determine which of the recommended revisions to the ./design-docs/design-delta.md from (Step 5) are actually necessary.


#### (Step 8) - Identify Revisions to Implement
Launch a new sonnet-engineer subagent to:
- Review the output of the (Step 6) and (Step 7) subagents. 
- Then determine if any of the recommended revisions to the ./design-docs/design-delta.md from (Step 5) are both valid and necessary.
- If no revisions are necessary, then skip ahead to (Step 10)
- If there are revisions which are necessary, then instead proceed to (Step 9)


#### (Step 9) - Implement Revisions to Delta 
Launch a new opus-engineer subagent to:
- Review the output of the (Step 4) and (Step 7) subagents.
- Implement the recommended revisions to the ./design-docs/design-delta.md that were deemed to be both valid and necessary in (Step 7).


### Plan the Implementation (for the current mono-repo only)


#### (Step 10) - Create the implementation plan
Launch a new opus-engineer subagent to:
- Review the ./design-docs/current-design.md and ./design-docs/design-delta.md
- Design an implementation plan specific to this current mono-repo with an ordered, numbered table of tasks that touches all of the impacted parts of this (./) current mono-repo necessary to implement the design in ./design-docs/design-delta.md 
- Document the mono-repo implementation plan within ./design-docs/plan.md 
