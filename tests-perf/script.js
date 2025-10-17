import http from "k6/http";
import { sleep, check } from "k6";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Read BASE_URL from env (Jenkins passes it), default to localhost when running locally
const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export const options = {
  duration: "30s",
  vus: 1,
  thresholds: {
    // http errors should be less than 1%
    http_req_failed: ["rate<0.01"],

    // --- Per-endpoint thresholds (more realistic) ---
    // Health should be very fast:
    "http_req_duration{name:health}": ["p(95)<200"],
    // Create bug may be slower (DB, hashing, etc.):
    "http_req_duration{name:create_bug}": ["p(95)<800"],

    // --- Previous global threshold (kept for reference) ---
    // http_req_duration: ["p(95)<500"], // 95 percent of response times must be below 500ms
  },
};

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`, { tags: { name: "health" } });
  check(healthRes, {
    "health check status is 200": (r) => r.status === 200,
  });

  // Create a new bug
  const payload = JSON.stringify({
    title: `Test Bug ${Date.now()}`,
    description: "This is a test bug created by k6",
    priority: "Medium",
    status: "Open",
  });

  const headers = { "Content-Type": "application/json" };

  const createBugRes = http.post(`${BASE_URL}/api/bugs`, payload, {
    headers,
    tags: { name: "create_bug" },
  });

  // Use r.json('id') which safely parses JSON and gets the field
  check(createBugRes, {
    "create bug status is 201": (r) => r.status === 201,
    "bug has an id": (r) => r.status === 201 && r.json && r.json("id") !== undefined,
  });

  sleep(5);
}

export function handleSummary(data) {
  return {
    "perf-results.html": htmlReport(data),
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
