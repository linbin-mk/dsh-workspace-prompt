/**
 * Workspace-specific prompt plugin (host half).
 *
 * Persistence (feature 3): a per-workspace prompt is stored in the
 * user-settings document under the `workspace-prompt` namespace, which the
 * settings provider persists to a file in the Harness home — so the content
 * survives a Harness restart with no extra work here.
 *
 * Injection (feature 2): the prompt is folded into the model context at
 * session start by mirroring the official `agent-instructions` mechanism — it
 * is entered exactly once, and later steps skip re-injection while an
 * identical copy still stands in the recorded session surface. It enters
 * again only when the configured text changes (or compaction drops the
 * earlier copy). A durable `user/message` carrying the prompt is managed in
 * the agent inbox at `agent/pre-step`, so it appears in the first model
 * request and is recorded in the session log. The source is `kind: 'plugin'`,
 * which marks the message as producer-supplied context rather than a human
 * prompt: the Web transcript projects every non-`user` source as a collapsed
 * context row, and host consumers that read human input (session titles,
 * skill and mention gestures, goal authority, wake budgets) skip it. The
 * official `agent-instructions` reconciliation only manages its own
 * `kind: 'agent-instructions'` messages, so it never disturbs this one.
 *
 * Keying: prompts are keyed by the session's absolute working directory
 * (`SessionHeader.cwd`), the stable identity of the workspace the session runs
 * in. The client resolves the same `cwd` for the current session.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { Session } from '@deepseek-ai/dsh-session';
export declare const name = "workspace-prompt";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
export type { Session };
