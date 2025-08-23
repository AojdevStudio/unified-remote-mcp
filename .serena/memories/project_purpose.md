# UnifiedMCP Project Purpose

## Overview
UnifiedMCP is a project for building a HTTP streamable transport MCP (Model Context Protocol) server using Cloudflare Workers with multi-user OAuth support. The goal is to create a unified interface for accessing Google Workspace and Microsoft 365 tools through Claude Desktop.

## Main Objectives
- Build a remote MCP server deployed on Cloudflare Workers
- Implement multi-user OAuth authentication
- Provide 12 unified tools (6 Google Workspace + 6 Microsoft 365)
- Support three-layer auth architecture:
  - Cloudflare OAuth (server access)
  - Google OAuth (Google API access)  
  - Microsoft Auth (Microsoft Graph API access)
- Integrate Stripe for payments and subscriptions

## Current Status
- Project is in early planning/documentation phase
- Comprehensive documentation structure is established
- No actual implementation code exists yet
- Focus is on Phase 1: Getting basic authenticated MCP server working with "Hello World" functionality

## Target Tech Stack
- Framework: Cloudflare Agents SDK (workers-mcp)
- Language: TypeScript
- Storage: Cloudflare D1 (SQLite) + Cloudflare KV (tokens)
- Auth: Multiple OAuth providers
- Payments: Stripe integration
- Transport: Streamable HTTP