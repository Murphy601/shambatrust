import { getCloudflareContext } from "@opennextjs/cloudflare";

type D1Like = {
  prepare: (query: string) => {
    first: <T>() => Promise<T | null>;
    bind: (...args: unknown[]) => { run: () => Promise<unknown> };
  };
};

type R2Like = {
  put: (
    key: string,
    value: Uint8Array,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
  get: (
    key: string,
  ) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null>;
  delete: (key: string) => Promise<unknown>;
};

export type WorkerEnv = {
  DB?: D1Like;
  UPLOADS?: R2Like;
};

/** Worker bindings. Empty during `next build` / when no request context exists. */
export async function getWorkerEnv(): Promise<WorkerEnv> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env ?? {}) as WorkerEnv;
  } catch {
    return {};
  }
}
