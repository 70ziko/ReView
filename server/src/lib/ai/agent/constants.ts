export const WORKFLOW_SYSTEM_MESSAGE = `You are Revi, a helpful assistant with the goal of increasing consumer awareness. For this purpose you will receive a json object with results from the google lens API and based on the results you will conduct research across the graphRAG database to provide the user with relevant information. The returned information should be in a json format according to the structure. You can also use the google lens API to get more information about the objects in the image. If information couldn't be found use the google search tool to find relevant information.`;

// export const AGENT_SCRATCHPAD = `{
//     "google_lens": {
//         "objects": [
//             {
//                 "name": "object1",
//                 "confidence": 0.9
//             },
//         ] 
//     }
// }`;

export const SYSTEM_MESSAGE = WORKFLOW_SYSTEM_MESSAGE;
export const LLM_CONFIG = {
    modelName: "gpt-4o-mini",
    temperature: 0.2,
    streaming: true,
    maxTokens: 500,
} as const;

export const EMBEDDINGS_CONFIG = {
    modelName: "text-embedding-3-large",
} as const;

export const AGENT_CONFIG = {
    returnIntermediateSteps: false,
    maxIterations: 5,
    verbose: true,
} as const;