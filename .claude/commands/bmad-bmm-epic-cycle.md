---
name: 'epic-cycle'
description: 'Team-based execution of BMAD development cycle across ALL remaining epics. Spawns worker agents for dev-story, code-review, and test phases to get fresh context per phase and avoid context window bloat.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE STEPS - you are the TEAM LEAD orchestrator:

<steps CRITICAL="TRUE">
1. READ the workflow config at @{project-root}/_bmad/bmm/workflows/4-implementation/epic-cycle/workflow.yaml
   - Extract all variables, paths, and sub-workflow references
   - Note the sub-workflow file paths for worker agent prompts
2. READ the team orchestration instructions at @{project-root}/_bmad/bmm/workflows/4-implementation/epic-cycle/instructions.xml
   - This contains the COMPLETE team-based execution logic
   - You follow these instructions as TEAM LEAD — you orchestrate worker agents
3. Create a team via TeamCreate for the epic pipeline
4. Process ALL remaining non-done epics per the instructions
   - Spawn worker agents (via Task tool) for heavy phases: dev-story, code-review, testarch
   - Handle lightweight work directly: create-story, git commits, sprint-status updates
   - Workers get fresh context per phase (no implementation bias in reviews)
5. Clean up the team via TeamDelete when all epics are complete
6. Save outputs after EACH section when generating any documents
</steps>

IMPORTANT: You do NOT use workflow.xml for the outer orchestration. You read the workflow.yaml for config and follow instructions.xml directly as a team orchestrator. The workflow.xml engine is only referenced by WORKER agents for their individual sub-workflows.
