// Stand-in for the published «Read weekly report» webhook, used by the e2e and API tests.
// Responses follow n8n/read-weekly-report.json: `{ report }` or `{ report: null }`.
import { readFileSync } from "node:fs"
import { createServer } from "node:http"

const port = Number(process.env.MOCK_N8N_PORT ?? 3211)
const token = process.env.MOCK_N8N_TOKEN
const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")

const responses = {
  "2026-11-16": [200, fixture("report-2026-11-16.json")],
  "2026-11-09": [200, fixture("report-zero-2026-11-09.json")],
  "2026-11-02": [500, JSON.stringify({ message: "Error in workflow" })],
  "2026-10-26": [200, JSON.stringify({ report: { repository: "tarasxryak/cs-math" } })],
}

createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`)
  if (url.pathname !== "/webhook/lab8-weekly-report") {
    response.writeHead(404).end()
    return
  }
  if (token && request.headers.authorization !== `Bearer ${token}`) {
    response.writeHead(403, { "Content-Type": "application/json" })
    response.end(JSON.stringify({ message: "Authorization data is wrong!" }))
    return
  }
  const [status, body] = responses[url.searchParams.get("weekStart")] ?? [
    200,
    JSON.stringify({ report: null }),
  ]
  response.writeHead(status, { "Content-Type": "application/json" })
  response.end(body)
}).listen(port, "127.0.0.1", () => {
  console.log(`mock n8n on http://127.0.0.1:${port}`)
})
