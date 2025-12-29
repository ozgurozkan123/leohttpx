import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { spawn } from "child_process";

const HTTPX_BINARY = process.env.HTTPX_PATH || "httpx";

const handler = createMcpHandler(
  async (server) => {
    server.tool(
      "httpx",
      "Scans target domains to detect active HTTP/HTTPS services using ProjectDiscovery's httpx.",
      {
        target: z
          .array(z.string())
          .nonempty()
          .describe("A list of domain or hostnames to scan (e.g., example.com)."),
        ports: z.array(z.number()).optional().describe("Optional list of ports to probe (e.g., 80, 443)."),
        probes: z
          .array(z.string())
          .optional()
          .describe("Optional list of httpx probes to enable (e.g., status-code, title, ip, cdn, tech-detect)."),
      },
      async ({ target, ports, probes }) => {
        const args: string[] = ["-u", target.join(","), "-silent"];

        if (ports && ports.length > 0) {
          args.push("-p", ports.join(","));
        }

        if (probes && probes.length > 0) {
          for (const probe of probes) {
            args.push(`-${probe}`);
          }
        }

        const output = await runHttpx(args);
        return {
          content: [
            {
              type: "text",
              text: output.trim() || "(no output)",
            },
          ],
        };
      }
    );
  },
  {
    capabilities: {
      tools: {
        httpx: {
          description:
            "Scans domains/hosts to detect active HTTP/HTTPS services and return httpx output.",
        },
      },
    },
  },
  {
    basePath: "",
    verboseLogs: true,
    maxDuration: 300,
    disableSse: true,
  }
);

function runHttpx(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(HTTPX_BINARY, args, {
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start httpx: ${error.message}`));
    });

    child.on("close", (code) => {
      if (code === 0 || code === null) {
        resolve(removeAnsi(stdout));
      } else {
        reject(new Error(`httpx exited with code ${code}. stderr: ${stderr}`));
      }
    });
  });
}

function removeAnsi(input: string): string {
  return input.replace(/\x1B\[[0-9;]*m/g, "");
}

export { handler as GET, handler as POST, handler as DELETE };
