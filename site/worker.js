// The plan search, off the page's main thread. Each message is one request; every reply carries the request's id.
import { runPlanRequest } from "./lib/planRequest.js";

onmessage = (event) => {
  runPlanRequest(event.data, {
    post: (message) => postMessage({ id: event.data.id, ...message }),
    now: () => performance.now()
  });
};
