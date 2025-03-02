import { DynamicTool } from 'langchain/tools';
import { GraphRagTools, ToolDependencies } from './types.js';

export function createSearchTools(_dependencies: ToolDependencies): GraphRagTools {
    return [
        new DynamicTool({
            name: "search_internet",
            description: "Simulates internet search capability to find information that might not be in the database.",
            func: async (query) => {
                return `(Note: In a real implementation, this would search the internet for "${query}". For now, please let the user know that internet search is a simulated capability and recommend focusing on the product database queries instead.)`;
            }
        })
    ];
}
