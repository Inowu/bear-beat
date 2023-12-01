import { execSync } from 'child_process';

const server = Bun.serve({
  port: process.env.STORAGE_SERVER_PORT || 8123,
  fetch: (req: Request) => {
    try {
      const result = execSync('df -h / | tail -n 1').toString();

      const lines = result.split('  ');
      const [, total, used, available] = lines;

      const totalStorage = parseInt(total.slice(0, -1), 10);
      const usedStorage = parseInt(used.slice(0, -1), 10);
      const availableStorage = parseInt(available.slice(0, -1), 10);

      return new Response(
        JSON.stringify({
          totalStorage,
          usedStorage,
          availableStorage,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
});

console.log(`Storage server running on port ${server.port}`);
