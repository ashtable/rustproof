# Turn a Design and a Plan into Tests and Code

The following prompt is used to turn a set of design documents, implementation plan and optionally an initial mockup specified by the user into a working implementation of code and tests.


## Relevant Skills

- Use the DBOS-python and DBOS-typescript skills for reference since there is not yet a DBOS-rust skill (for the very new DBOS Rust SDK: https://github.com/dbos-inc/dbos-transact-rust), as applicable for any work involing DBOS workflows or DBOSClient SDKs
- Use the frontend-design skill as reference for UI work on the Claude Code Plugin Mod UI/rustproof-cli UI
- Use the mcp-server-terminal mcp server (installed here) as needed when designing or verifying front-end rustproof-cli functionality in the terminal (https://github.com/aybelatchane/mcp-server-terminal)
- Use the "claude plugin eval", "claude plugin test" and "claude plugin validate" as needed when designing, writing, running tests or verifying the rustproof Claude Code Plugin/Mod functionality (https://code.claude.com/docs/en/plugins/mods/overview)


## Code Locations

- ./ - The rustproof Claude Plugin & rustproof CLI mono-repo (public, Apache 2.0 repo)
- ../rustproof-platform/ - The "rustproof-platform" mono-repo (private repo)  


## Design Docs, Mockup, Current Code & Implementation Plan

### Review the User's request and mockups

#### (Step 1) - Review the user's request and any mockups
Launch a new sonnet-engineer subagent to:
- Download any Claude Design files specified by the user. 
- Review the user's request and identify relevant aspects of the Claude Design files
- Conduct any web searches necessary to research the user's request. 
- Then document findings for a subsequent subagent in the ./scratch/ directory.

### Review the Design Docs & Plan 

#### (Step 2) - Review the design docs
Launch a separate, new sonnet-engineer subagent to explore and summarize the contents of each of the following design documents--specifically from the perspective of needing to implement the task(s) the user requested--for a subsequent subagent within the ./scratch/ directory:
- current system's most recent design document: ./design-docs/current-design.md 
- overall set of design changes we need to implement, which may be partially done: ./design-docs/design-delta.md
- overall implementation plan we need to implement, which may be partially done: ./design-docs/plan.md
- spec: ./design-docs/rustproof-spec.md


### Review the codebase

#### (Step 3) - Review the current state of the codebase 
Launch a new sonnet-engineer subagent to review the code in each of the following directories from the perspectives of how it differs from the current-design.md, design-delta.md and plan.md; and the task(s) the user requested to have implemented. Record notes within the ./scratch/ directory for subsequent subagents:
- ./
- ../rustproof-platform/


### Cross-Project, TDD Implemenation

#### (Step 4) - Design the TDD Plan 
Launch a new opus-engineer subagent to:
- Review the output of the (Step 1), (Step 2) and (Step 3) subagents
- Assemble an overall test-driven development plan using Playwright and Unit tests as appropriate for the specific task(s) that the user requested to have completed (note: we have a Playwright plugin and MCP server)
- Be sure to note any cross-repo dependencies across the two mono-repos (./ and ../rustproof/)
overall project 
- Document this design in the TDD ./scratch/ directory for a subsequent subagent 


#### (Step 5) - Implement the TDD Plan
Launch a new opus-engineer subagent to:
- Review the output of the (Step 1), (Step 2), (Step 3) and (Step 4) subagents.
- Use test-driven development with unit tests and Playwright end-to-end tests, as appropriate, to implement the TDD Plan assembled by the (Step 4) subagent 


#### (Step 6) - Commit the implementation
Launch a new sonnet-engineer subagent to:
- Review, commit and push any outstanding code changes from (Step 5) that are still uncommitted

### Review and Revise the Cross-Project, TDD Implemenation

#### (Step 7) - Review the implementation
Launch a new opus-engineer subagent to:
- Review the output of the (Step 1), (Step 2), (Step 3), (Step 4) and (Step 5) subagents.
- Assemble a list of recommended revisions to the TDD implementation from (Step 5) within the ./scratch/ directory for a subsequent subagent.


#### (Step 8) - Review the Recommended Revisions
Launch a new sonnet-engineer subagent to:
- Review the output of the (Step 1), (Step 2), (Step 3), (Step 4), (Step 5) and (Step 7) subagents.
- Then determine which of the recommended revisions from (Step 7) are actually valid.


#### (Step 9) - Review the Recommended Revisions
Launch a new sonnet-engineer subagent to:
- Review the output of the (Step 1), (Step 2), (Step 3), (Step 4), (Step 5) and (Step 7) subagents.
- Then determine which of the recommended revisions from (Step 7) are actually necessary.


#### (Step 10) - Identify Revisions to Implement
Launch a new sonnet-engineer subagent to:
- Review the output of the (Step 8) and (Step 9) subagents. 
- Then determine if any of the recommended revisions from (Step 7) are both valid and necessary.
- If no revisions are necessary, then skip ahead to (Step 12)
- If there are revisions which are necessary, then instead proceed to (Step 11)


#### (Step 11) - Implement Revisions to tests and code
Launch a new opus-engineer subagent to:
- Review the output of the (Step 1), (Step 2), (Step 3), (Step 4), (Step 5) and (Step 10) subagents.
- Use test-driven development with unit tests and Playwright end-to-end tests, as appropriate, to implement the recommended revisions to the code and tests deemed both valid and necessary by the (Step 10) subagent.


#### (Step 12) - Commit the revisions
Launch a new sonnet-engineer subagent to:
- Review, commit and push any outstanding code changes from (Step 11) that are still uncommitted


### Release 

#### (Step 13) - Release all changes in GitHub
Launch a new sonnet-engineer subagent to:
- Finally, run any applicable release process 

### Update the Implemenation Plan

#### (Step 14) - Update the Plan's Task List
- If, and only if, applicable: Mark each completed task from the implementation plan in ./design-docs/plan.md Done with a Green Checkmark Emoji next to its number in the table

