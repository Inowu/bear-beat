import { execSync } from "node:child_process";
import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const resolveSentryRelease = (fallback = ""): string => {
  const fromEnv =
    process.env.SENTRY_RELEASE ||
    process.env.COMMIT_REF || // Netlify
    process.env.GITHUB_SHA || // GitHub Actions
    process.env.VERCEL_GIT_COMMIT_SHA || // Vercel
    process.env.BUILD_SOURCEVERSION || // Azure DevOps / others
    "";
  if (fromEnv) return fromEnv;

  try {
    // Match Sentry's default behavior: fall back to git HEAD when available.
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const compatEnv: Record<string, string> = {};

  // Load REACT_APP_* vars from both:
  // - Vite env files (`loadEnv`)
  // - the real process env (Netlify/CI injects vars there)
  const mergedEnv = { ...env, ...process.env } as Record<string, string | undefined>;
  for (const [key, value] of Object.entries(mergedEnv)) {
    if (!key.startsWith("REACT_APP_")) continue;
    if (typeof value !== "string") continue;
    compatEnv[key] = value;
  }

  compatEnv.NODE_ENV = mode === "production" ? "production" : "development";

  // Ensure frontend events include `release` so uploaded sourcemaps can be applied.
  const sentryRelease =
    compatEnv.REACT_APP_SENTRY_RELEASE ||
    resolveSentryRelease();
  if (sentryRelease) compatEnv.REACT_APP_SENTRY_RELEASE = sentryRelease;

  // Sourcemap upload is enabled only when the required Sentry env vars are present.
  const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
  const sentryOrg = process.env.SENTRY_ORG;
  const sentryProject = process.env.SENTRY_PROJECT;
  const uploadSourcemaps =
    mode === "production" &&
    Boolean(sentryAuthToken && sentryOrg && sentryProject);

  const sentryProjectOption = sentryProject?.includes(",")
    ? sentryProject
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : sentryProject;

  return {
    plugins: [
      react(),
      ...(uploadSourcemaps
        ? sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProjectOption,
            release: {
              name: sentryRelease,
              // Keep deploys robust: sourcemaps matter, commit association is optional.
              setCommits: false,
            },
            sourcemaps: {
              // Upload + then delete sourcemaps so they're not publicly accessible.
              // Use an absolute glob so it works regardless of the build CWD (workspace vs repo root).
              filesToDeleteAfterUpload: path.resolve(__dirname, "dist/**/*.map"),
            },
          })
        : []),
    ],
    resolve: {
      alias: {
        src: path.resolve(__dirname, "src"),
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          includePaths: [path.resolve(__dirname)],
        },
      },
    },
    define: {
      "process.env": JSON.stringify(compatEnv),
      global: "globalThis",
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    preview: {
      host: "0.0.0.0",
      port: 4173,
    },
    build: {
      outDir: "dist",
      sourcemap: uploadSourcemaps ? "hidden" : false,
    },
  };
});
