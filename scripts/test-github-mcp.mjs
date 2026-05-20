/**
 * Test: Node MCP client → GitHub MCP server (Docker + stdio)
 *
 * Prerequisites:
 * - Docker Desktop running
 * - GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN in .env
 *
 * Run: npm run test:mcp
 */
import 'dotenv/config'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const token =
  process.env.GITHUB_PERSONAL_ACCESS_TOKEN?.trim() ||
  process.env.GITHUB_TOKEN?.trim()

if (!token) {
  console.error(
    'Missing token. Set GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN in .env',
  )
  process.exit(1)
}

const transport = new StdioClientTransport({
  command: 'docker',
  args: [
    'run',
    '-i',
    '--rm',
    '-e',
    'GITHUB_PERSONAL_ACCESS_TOKEN',
    'ghcr.io/github/github-mcp-server',
  ],
  env: {
    ...process.env,
    GITHUB_PERSONAL_ACCESS_TOKEN: token,
  },
  stderr: 'inherit',
})

const client = new Client({ name: 'stanup-test', version: '1.0.0' })

try {
  console.log('Connecting to GitHub MCP server (Docker)…\n')
  await client.connect(transport)

  const { tools } = await client.listTools()
  console.log(`Found ${tools.length} tools. First 15:\n`)
  for (const t of tools.slice(0, 15)) {
    console.log(`  • ${t.name}`)
  }
  if (tools.length > 15) {
    console.log(`  … and ${tools.length - 15} more`)
  }

  console.log('\nGitHub MCP is working. Next: wire this into standup generation.')
} catch (err) {
  console.error('\nFailed:', err instanceof Error ? err.message : err)
  console.error('\nChecks:')
  console.error('  1. Docker Desktop is open and running')
  console.error('  2. Close and reopen terminal after installing Docker')
  console.error('  3. Run: docker pull ghcr.io/github/github-mcp-server')
  process.exit(1)
} finally {
  await client.close()
}
