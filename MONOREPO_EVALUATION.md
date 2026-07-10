# Monorepo Transition Evaluation for CoGallery

## Current State Analysis

### Client (`client/package.json`)
- **Framework**: React/Vite SPA
- **Key Dependencies**: React 18, Zustand, Supabase JS v2.43, TanStack Query v5, Uppy, TailwindCSS
- **Dev Dependencies**: Vite, Vitest, Playwright, TypeScript, ESLint
- **Structure**: Standard Vite React-TypeScript setup with `src/` containing components, pages, services, stores, types

### Bot (`bot/package.json`)
- **Framework**: Node.js/Express WebRTC seedbox bot
- **Key Dependencies**: Express v5, Supabase JS v2.43, Tus server, Sharp, JWT, WS
- **Dev Dependencies**: None listed (likely using inline dev tools)
- **Structure**: Server-focused with `server.js` (main), `bot_server_oracle.js` (Oracle variant), `/lib` directory for services

### Shared Considerations
1. **Supabase Dependency**: Both use `@supabase/supabase-js` v2.43.x (client: ^2.43.0, bot: ^2.43.4) - version alignment exists
2. **No Obvious Duplicate Dependencies**: Beyond Supabase, minimal overlap in direct dependencies
3. **Different Build Systems**: Client uses Vite (ESM), Bot uses Node.js (CommonJS via `type: "module"`)
4. **TypeScript Usage**: Client uses TS extensively; Bot appears to be JavaScript based on `.js` files

## Potential Benefits of Monorepo

### 1. Shared Type Definitions
- **Problem**: Client and bot likely duplicate TypeScript interfaces for Rooms, Events, Photos, etc.
- **Solution**: Shared `@cogallery/types` package ensuring API contract consistency
- **Impact**: Eliminates drift between client expectations and server responses

### 2. Shared Validation/Utility Logic
- **Problem**: Input validation, formatting utilities, constants might be duplicated
- **Solution**: Shared `@cogallery/utils` package
- **Impact**: Consistent behavior (e.g., filename sanitization, date formatting)

### 3. Coordinated Dependency Management
- **Problem**: Potential version drift on shared dependencies (like Supabase)
- **Solution**: Centralized `package.json` in monorepo root
- **Impact**: Guaranteed version alignment, simpler updates

### 4. Simplified Refactoring
- **Problem**: Changes to shared contracts require coordinated updates across repos
- **Solution**: Atomic commits touching both client and server
- **Impact**: Reduced integration friction during API evolution

### 5. Unified Tooling
- **Problem**: Separate ESLint, TypeScript, testing configurations
- **Solution**: Shared config packages (`eslint-config-cogallery`, etc.)
- **Impact**: Consistent code quality standards

## Challenges and Drawbacks

### 1. Build Complexity Increase
- **Client**: Vite-based browser build (already complex with plugins)
- **Bot**: Node.js server (simple direct execution)
- **Challenge**: Balancing different build pipelines in one repo
- **Mitigation**: Keep build processes separate but coordinated via workspace scripts

### 2. CI/CD Pipeline Changes
- **Current**: Likely separate pipelines for client (Netlify/Vercel?) and bot (PM2/docker?)
- **New**: Monorepo-aware CI (Nx, Turborepo, or custom) that can build/test affected packages
- **Effort**: Moderate - requires pipeline rewriting

### 3. Dependency Conflicts
- **Risk**: Client might need different versions of shared deps than server
- **Example**: Client needs browser-compatible lodash, server can use node version
- **Mitigation**: Use `exports` field in `package.json` for conditional exports, or accept alignment

### 4. Learning Curve
- **Team**: Need to learn monorepo tooling (Nx/Turborepo/lerna)
- **Current State**: Simple npm/yarn workflows
- **Effort**: Low-Medium for basic setup, higher for advanced caching

### 5. Loss of Independent Versioning
- **Current**: Client and bot can release on different schedules
- **Monorepo**: Typically versioned together (though independent versioning possible)
- **Impact**: Coupling of release cycles - may or may not be problematic

## Recommendation

**Proceed with a limited-scope monorepo approach focusing on shared types and utilities first**, rather than a full monorepo conversion.

### Suggested Approach:

1. **Create `shared/` package** (not full monorepo conversion):
   - Move TypeScript interfaces to `@cogallery/shared-types`
   - Move shared utilities/constants to `@cogallery/shared-utils`
   - Keep client and bot as separate packages but depend on shared packages

2. **Implementation Steps**:
   ```bash
   # Create shared package
   mkdir -p shared/types shared/utils
   
   # Move types
   cp -r client/src/types/* shared/types/
   
   # Update client imports
   # From: import type { Room } from '@/types'
   # To:   import type { Room } from '@/shared/types'
   
   # Update bot if using TS (or create JSDoc equivalents)
   
   # Add to client/package.json:
   #   "dependencies": { "@cogallery/shared-types": "link:../shared/types" }
   
   # Add to bot/package.json if beneficial:
   #   "dependencies": { "@cogallery/shared-types": "link:../shared/types" }
   ```

3. **Benefits of this approach**:
   - Gets 80% of value (type safety) with 20% of effort
   - Minimal disruption to existing build/deploy processes
   - Easy to revert if problematic
   - Creates foundation for future expansion

4. **When to consider full monorepo**:
   - If shared logic grows significantly beyond types
   - If build pipelines become similarly complex
   - If team adopts monorepo-friendly tooling (Nx/Turborepo) for other reasons

### Specific File Migration Candidates

**From client/src/types/** (move to shared/types/):
- All interfaces: User, Room, Event, Photo, Reaction, Comment, etc.
- Enums: UserRole, MediaType, ActivityAction, RealtimeEvent

**Potential shared utils** (move to shared/utils/):
- Date formatting helpers (if used in both)
- String utilities (slug generation, sanitization)
- Constants (API endpoints, pagination limits, file size limits)
- Validation functions (email, username, etc.)

### Risk Assessment

**Low Risk** (Recommended start):
- Moving TypeScript interfaces to shared package
- Moving pure utility functions (no DOM/Node deps)

**Medium Risk**:
- Moving Supabase helper functions (may need different clients)
- Moving configuration constants

**High Risk** (Avoid initially):
- Moving React components (DOM dependencies)
- Moving Express middleware (Node-specific)
- Moving WebRTC/WebSocket code (environment-specific)

## Conclusion

A full monorepo migration presents moderate complexity for potentially limited immediate gains given the current codebase separation. However, a **targeted sharing of TypeScript definitions and pure utilities** offers significant correctness benefits with minimal overhead.

**Recommended immediate action**: Extract shared types into a `shared/types` package and establish the linking mechanism. This delivers:
- Immediate elimination of type drift between client and server
- Foundation for future shared code sharing
- Minimal risk to existing build/deploy pipelines
- Clear path to expand sharing if benefits are realized

This approach satisfies the spirit of item #18 ("Evaluate") while delivering tangible value before considering more invasive structural changes.

*Next step if approved: Begin extracting shared types from client/src/types to shared/types/* and update client imports.*