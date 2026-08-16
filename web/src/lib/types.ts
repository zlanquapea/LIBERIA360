// Re-exports the shared wire types from @liberia360/shared-types (a local
// npm workspace package — see packages/shared-types) instead of
// hand-mirroring backend response shapes here directly. Every existing
// `import { X } from '@/lib/types'` (or relative equivalent) across this
// app keeps working unchanged; only the underlying declarations moved.
export * from "@liberia360/shared-types";
