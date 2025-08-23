# Suggested Commands

## Changelog Management
The project has Python-based changelog automation scripts using uv:

### Primary Commands
```bash
# Auto-analyze git commits and update changelog
./scripts/changelog/update-changelog.py --auto

# Manual changelog entry mode
./scripts/changelog/update-changelog.py --manual

# Preview changes without modifying files
./scripts/changelog/update-changelog.py --auto --dry-run

# Update with specific version
./scripts/changelog/update-changelog.py 1.5.0 --auto

# Force mode (no prompts) for CI/CD
./scripts/changelog/update-changelog.py --auto --force
```

### Git Commands
```bash
# Standard git workflow
git status
git add .
git commit -m "docs: update changelog for v1.5.0"
git tag v1.5.0
git push --tags
```

## Development Commands
Since this is primarily a documentation/planning project:

```bash
# Navigate project structure
find docs/ -name "*.md" | head -20
ls -la scripts/

# Check project status
git log --oneline -10
git branch -a
```

## File Operations
```bash
# Search documentation
grep -r "keyword" docs/
find docs/ -name "*pattern*"

# Execute Python scripts with uv (self-contained)
./scripts/changelog/update-changelog.py --help
```

## Notes
- No build, lint, test, or run commands exist yet (project is in planning phase)
- Main implementation will be TypeScript/Cloudflare Workers (planned)
- Current scripts use uv for Python dependency management (self-contained)