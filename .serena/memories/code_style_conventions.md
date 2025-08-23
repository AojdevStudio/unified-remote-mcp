# Code Style and Conventions

## Python Scripts (Current Implementation)
Based on the existing changelog automation scripts:

### Python Style
- **Dependencies**: Managed via uv inline metadata (self-contained scripts)
- **CLI Framework**: Click for command-line interfaces
- **Documentation**: Comprehensive docstrings and comments
- **Error Handling**: Comprehensive error handling with graceful fallbacks
- **File Operations**: Safe file operations with backup creation
- **Git Integration**: Direct git command integration

### Script Structure
- Functions are well-documented with clear purposes
- Input validation and confirmation prompts
- Support for dry-run and verbose modes
- Cross-platform compatibility considerations

## Documentation Standards (Established)
- **Format**: Markdown with clear hierarchy
- **Organization**: Comprehensive folder structure with logical grouping
- **Naming**: Descriptive filenames with creation/modification dates
- **Linking**: Cross-references between related documents
- **Standards**: Consistent formatting and structure

### Documentation Conventions
- Use clear, descriptive filenames
- Include creation/modification dates
- Link related documents
- Maintain consistent formatting
- Update index.md when adding new sections

## Future TypeScript/Cloudflare Workers (Planned)
From the specifications:
- **Framework**: Cloudflare Agents SDK
- **Language**: TypeScript with strict typing
- **Architecture**: Three-layer auth system
- **Security**: OAuth integration with token encryption
- **Error Handling**: Comprehensive error boundaries
- **Testing**: Unit, integration, and end-to-end testing

## Git Conventions
- **Commit Messages**: Support for conventional commits (feat:, fix:, etc.)
- **Versioning**: Semantic versioning (semver)
- **Changelog**: Automated changelog generation from git commits
- **Tags**: Version tagging for releases