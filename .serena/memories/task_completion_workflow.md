# Task Completion Workflow

## Current Project State
This project is in documentation/planning phase with minimal code implementation.

## When Completing Tasks

### Documentation Tasks
1. **Update relevant documentation** in the appropriate docs/ subdirectory
2. **Update docs/index.md** if adding new sections or major changes
3. **Follow naming conventions** with descriptive filenames
4. **Cross-reference** related documents

### Code Development Tasks (When Implementation Begins)
Based on project specifications:

1. **Follow Archon workflow** as specified in CLAUDE.md:
   - Check current tasks via Archon MCP server
   - Research using RAG queries and code examples
   - Update task status through the workflow
   - Mark tasks as "review" when complete

2. **Testing Requirements** (planned):
   - Unit tests for each tool
   - Integration tests for OAuth flows  
   - Load testing for Cloudflare Workers
   - End-to-end testing with Claude Desktop

3. **Security Validation**:
   - Token encryption/decryption validation
   - OAuth flow security checks
   - Rate limiting verification
   - Error boundary testing

### Version Management
1. **Update changelog** using automated scripts:
   ```bash
   ./scripts/changelog/update-changelog.py --auto
   ```
2. **Commit changes** with conventional commit messages
3. **Tag releases** with semantic versioning
4. **Update documentation** to reflect version changes

### Quality Assurance
- Follow research-driven development standards
- Validate against best practices through RAG queries
- Cross-reference multiple sources for validation
- Document assumptions and limitations

## Pre-Deployment Checklist (Future)
- [ ] Implementation follows researched best practices
- [ ] Code follows project style guidelines  
- [ ] Security considerations addressed
- [ ] Basic functionality tested
- [ ] Documentation updated if needed
- [ ] Changelog updated
- [ ] Version tagged appropriately