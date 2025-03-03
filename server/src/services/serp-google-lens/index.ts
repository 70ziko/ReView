import { getJson } from "serpapi";

export default async function serpGoogleLens(query: string) {
  const result = await getJson({
    engine: "google_lens",
    q: query,
    google_domain: "google.com",
    api_key: process,
  });
  return result;
}
