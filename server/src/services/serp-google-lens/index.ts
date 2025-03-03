import { getJson } from "serpapi";

export default async function serpGoogleLens(url: string) {
  const result = await getJson({
    engine: "google_lens",
    url: url,
    api_key: process.env.SERPAPI_KEY,
  });
  return result;
}
