import { execSync, spawnSync } from "node:child_process";
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

const validateSentryAuth = (opts: {
  authToken?: string;
  org?: string;
  project?: string | string[];
  url?: string;
}): boolean => {
  const authToken = typeof opts.authToken === "string" ? opts.authToken.trim() : "";
  const org = typeof opts.org === "string" ? opts.org.trim() : "";
  const projectRaw = opts.project;
  const project =
    typeof projectRaw === "string"
      ? projectRaw.trim()
      : Array.isArray(projectRaw)
        ? String(projectRaw[0] ?? "").trim()
        : "";

  if (!authToken || !org || !project) return false;

  const sentryCliPath = path.resolve(__dirname, "../node_modules/.bin/sentry-cli");
  const result = spawnSync(sentryCliPath, ["info"], {
    stdio: "ignore",
    env: {
      ...process.env,
      SENTRY_AUTH_TOKEN: authToken,
      SENTRY_ORG: org,
      SENTRY_PROJECT: project,
      ...(typeof opts.url === "string" && opts.url.trim() ? { SENTRY_URL: opts.url.trim() } : {}),
    },
  });

  return result.status === 0;
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
  const sentryUrl = process.env.SENTRY_URL;

  const sentryProjectOption = sentryProject?.includes(",")
    ? sentryProject
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : sentryProject;

  const hasSentryConfig = Boolean(
    mode === "production" &&
      sentryAuthToken &&
      sentryOrg &&
      sentryProjectOption &&
      (Array.isArray(sentryProjectOption) ? sentryProjectOption.length > 0 : true),
  );

  const uploadSourcemaps = hasSentryConfig
    ? validateSentryAuth({
        authToken: sentryAuthToken,
        org: sentryOrg,
        project: sentryProjectOption,
        url: sentryUrl,
      })
    : false;

  if (hasSentryConfig && !uploadSourcemaps) {
    console.warn(
      "[vite] Sentry sourcemap upload disabled: credentials are invalid or Sentry is unreachable. Build continues safely.",
    );
  }

  return {
    plugins: [
      react(),
      ...(uploadSourcemaps
        ? sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProjectOption,
            telemetry: false,
            silent: true,
            errorHandler: (err) => {
              console.warn(`[vite] Sentry upload skipped: ${err.message}`);
            },
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
