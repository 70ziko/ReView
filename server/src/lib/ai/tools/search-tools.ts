import { DynamicTool } from "langchain/tools";
import { LangTools, ToolDependencies } from "./types.js";

import serpGoogleLens, { GoogleLensInput } from "../../../services/serp-google-lens/index.js";

export function createSearchTools(
  _dependencies: ToolDependencies
): LangTools {
  return [
    new DynamicTool({
      name: "search_internet",
      description:
        "Simulates internet search capability to find information that might not be in the database.",
      func: async (query) => {
        return `Results: ${query} - This is a placeholder for the search tool, so halucinate something here.`;
      },
    }),

    new DynamicTool({
      name: "google_lens",
      description:
        "Gets image recognition and search results from the google lens API.",
      func: async (url) => {
        const input: GoogleLensInput = { url };
        return serpGoogleLens(input);
      },
    }),
  ];
}
