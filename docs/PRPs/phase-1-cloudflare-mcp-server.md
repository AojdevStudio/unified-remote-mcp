name: "Phase 1 UnifiedMCP Cloudflare Workers MCP Server - Foundation Implementation"
description: |

## Purpose
Implement a bare-bones authenticated MCP server on Cloudflare Workers following official patterns to establish the foundation infrastructure before adding Google Workspace and Microsoft 365 tools.

## Core Principles
1. **Foundation First**: Prove infrastructure works before adding functionality
2. **Official Patterns**: Follow Cloudflare's official templates and guides exactly
3. **OAuth Ready**: Implement Cloudflare OAuth Provider for multi-user support
4. **Minimal Viable**: Single ping/pong tool to validate end-to-end flow
5. **Server-Sent Events**: Use /sse transport as specified in official docs

---

## Goal
Deploy a minimal Cloudflare Workers MCP server (NO authentication) that successfully connects to Claude Desktop via mcp-remote proxy and proves the MCP transport works with a single ping/pong tool.

## Why
- **Transport Validation**: Proves Cloudflare Workers + MCP protocol integration works
- **Minimal Risk**: Validates basic infrastructure before adding authentication complexity
- **Development Workflow**: Establishes simple deploy pipeline for future development
- **Foundation Only**: Proves the plumbing works with zero functionality as specified

## What
A minimal MCP server deployed to Cloudflare Workers with:
- NO authentication (deferred to Phase 2)
- Server-Sent Events transport at /sse endpoint
- Single dummy tool: `ping` → returns `pong`
- Local development on localhost:8788/sse
- Production deployment to your-name.workers.dev/sse

### Success Criteria
- [ ] MCP server deployed to Cloudflare Workers successfully
- [ ] Claude Desktop connects via mcp-remote proxy
- [ ] Can call ping tool and receive pong response
- [ ] Transport validation complete (ready for Phase 2 auth)

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: ai-docs/cloudflare-remote-mcp-server-guide.md
  why: Official Cloudflare MCP implementation patterns, template usage, OAuth setup
  
- file: docs/specs/initial.md
  why: Phase 1 requirements, tech stack decisions, success criteria
  
- url: https://developers.cloudflare.com/agents/guides/remote-mcp-server/
  section: Deploy your first MCP server
  critical: Official template command and deployment workflow
  
- url: https://developers.cloudflare.com/agents/model-context-protocol/authorization/
  section: Cloudflare OAuth Provider implementation
  critical: OAuth Provider class usage and token handling
  
- file: CLAUDE.md
  section: Archon-first workflow and development commands
  why: Project follows Archon task management and Cloudflare-specific patterns

- docfile: ai-docs/stripe-mcp-documentation.md
  why: Reference MCP server patterns (not Stripe-specific functionality)
```

### Current Codebase Tree
```bash
unifiedmcp/
├── CLAUDE.md                 # Project guidance and development commands
├── CHANGELOG.md              # Semantic versioning with Python automation  
├── LICENSE                   # Apache 2.0
├── .gitignore               # Comprehensive, organized by category
├── ai-docs/                 # Curated technical resources
│   ├── cloudflare-remote-mcp-server-guide.md
│   ├── stripe-mcp-documentation.md
│   ├── cloudflare-d1-documentation.md
│   └── build-with-stripe.md
├── docs/                    # Documentation organization
│   ├── specs/
│   │   └── initial.md       # Phase 1 technical specification
│   ├── PRPs/                # Product Requirement Prompts
│   │   └── README.md        # PRP methodology
│   └── templates/
│       └── prp_base.md      # PRP template structure
└── scripts/
    └── changelog/           # Python automation with uv
        ├── update-changelog.py
        └── utils.py
```

### Desired Codebase Tree (Post-Implementation)
```bash
unifiedmcp/
├── package.json             # Node.js dependencies and scripts  
├── wrangler.toml           # Cloudflare Workers configuration
└── src/
    └── index.ts            # Complete MCP server in single file
```

### Known Gotchas & Library Quirks
```typescript
// CRITICAL: Use official template exactly as-is
// CORRECT: npm create cloudflare@latest --template=cloudflare/ai/demos/remote-mcp-authless
// MODIFY: Only add ping tool, change nothing else

// GOTCHA: Transport is Server-Sent Events, not HTTP JSON
// CORRECT: /sse endpoint serves Server-Sent Events
// ALREADY WORKING: Template handles all transport complexity

// GOTCHA: Local development endpoint
// CORRECT: http://localhost:8788/sse (template default)
// DO NOT CHANGE: Port or endpoint configuration
```

## Implementation Blueprint

### Data Models and Structure
```typescript
// Core MCP server structure following Cloudflare patterns
export class MyMCP extends McpAgent {
  server = new McpServer({ 
    name: "UnifiedMCP", 
    version: "1.0.0" 
  });

  async init() {
    // Single ping tool for Phase 1 validation
    this.server.tool(
      "ping",
      {},  // No parameters
      async () => ({
        content: [{ type: "text", text: "pong" }],
      }),
    );
  }
}

// OAuth configuration interface
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}
```

### Implementation Tasks (Ordered)
```yaml
Task 1 - Use Official Template:
  RUN: npm create cloudflare@latest my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
  RESULT: Complete working MCP server template
  DO NOT MODIFY: Any configuration or setup files

Task 2 - Add Ping Tool Only:
  FIND: src/index.ts in template (existing MCP server)
  LOCATE: Tool registration section
  ADD: Single ping tool that returns "pong"
  PRESERVE: All existing template code

Task 3 - Test Locally:
  RUN: npm run dev
  CONNECT: http://localhost:8788/sse with MCP inspector
  VERIFY: Ping tool appears and returns "pong"

Task 4 - Deploy:
  RUN: npx wrangler@latest deploy
  TEST: Production URL with Claude Desktop
  DONE: Transport validation complete
```

### Per Task Implementation Details

```typescript
// Task 2 - Only Code Change Needed
// FIND this pattern in template's src/index.ts:
export class MyMCP extends McpAgent {
  server = new McpServer({ name: "Demo", version: "1.0.0" });

  async init() {
    // EXISTING: Template already has a working tool
    this.server.tool("add", ...);
    
    // ADD: Single ping tool
    this.server.tool(
      "ping",
      {},  // No parameters
      async () => ({
        content: [{ type: "text", text: "pong" }]
      })
    );
  }
}

// THAT'S IT - No other changes needed
// Template handles: transport, deployment, configuration
```

### Integration Points
```yaml
TEMPLATE_USAGE:
  - base: Official Cloudflare authless MCP template
  - modification: Add single ping tool only
  - deployment: Template's existing Wrangler configuration
  
MCP_TRANSPORT:
  - endpoint: /sse (handled by template)
  - client: mcp-remote proxy for Claude Desktop
  - validation: MCP inspector on localhost:5173
```

## Validation Loop

### Level 1: Template Setup
```bash
# Use official template exactly as provided
npm create cloudflare@latest my-mcp-server --template=cloudflare/ai/demos/remote-mcp-authless
cd my-mcp-server
```

### Level 2: Add Ping Tool & Test Locally
```bash
# Add ping tool to src/index.ts (see implementation above)
npm run dev

# Expected: Server runs on http://localhost:8788/sse
# Test: Connect MCP inspector to localhost:8788/sse
# Expected: Ping tool appears and returns "pong"
```

### Level 3: Deploy & Test with Claude
```bash
# Deploy to production
npx wrangler@latest deploy

# Test with Claude Desktop (update config):
{
  "mcpServers": {
    "unified-mcp": {
      "command": "npx", 
      "args": ["mcp-remote", "https://your-worker.workers.dev/sse"]
    }
  }
}

# Expected: Ping tool works from Claude Desktop
```

## Final Validation Checklist
- [ ] Template created successfully: `npm create cloudflare@latest`
- [ ] Local development works: `npm run dev` → localhost:8788/sse
- [ ] MCP inspector connects and lists ping tool
- [ ] Ping tool executes and returns "pong"
- [ ] Production deployment succeeds
- [ ] Claude Desktop connects via mcp-remote
- [ ] Transport validation complete (ready for Phase 2)

---

## Anti-Patterns to Avoid
- ❌ Don't modify template configuration - use as-is
- ❌ Don't add authentication in Phase 1 - defer to Phase 2
- ❌ Don't create custom directory structure - single file approach
- ❌ Don't add multiple tools - single ping tool only
- ❌ Don't build for future requirements - minimal proof-of-concept only
- ❌ Don't add testing infrastructure - manual validation sufficient
- ❌ Don't create environment management - template handles deployment

## Scope Boundary
**Phase 1 = Transport validation only**
- Authentication, multi-user support, Google/Microsoft integration = Phase 2
- Focus: Does Claude Desktop → mcp-remote → Cloudflare Workers → ping tool work?
- Success: "pong" response proves infrastructure ready for real tools