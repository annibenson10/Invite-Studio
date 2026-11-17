/// <reference types="@cloudflare/workers-types" />

// Bindings and secrets this app reads from the Cloudflare environment.
interface Env {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
  SESSION_SECRET?: string;
}
