export const LLM_CONFIG = {
  modelName: "gpt-4o-mini",
  temperature: 0.2,
  streaming: false,
  maxTokens: 1500,
  // verbose: true,
} as const;

export const EMBEDDINGS_CONFIG = {
  modelName: "text-embedding-3-large",
} as const;

export const AGENT_CONFIG = {
  returnIntermediateSteps: true,
  returnOnlyOutputs: true,
  returnScratchpad: false,
  handleParsingErrors: false,
  // maxIterations: 15,
  // verbose: true,
} as const;

export const WORKFLOW_SYSTEM_MESSAGE = `You are Review Getter, a workflow agent. You will receive a json object with results from the google lens API and based on the results you will conduct research across the graphRAG database to provide the user with relevant information about his product. You need to work autonomously with the tools you have available in order to provide the information according to the output function schema. Use available tools to lookup information in the database and only if not found search the internet for it. The returned information should be in a json format according to the expected schema.`;

export const ASSISTANT_SYSTEM_MESSAGE = `You are Revi, a helpful assistant with the goal of increasing consumer awareness. For this purpose you will have results available in the conversation from the workflow agent that does the initial research across the database and internet, based on previous messages and research across the graphRAG database and internet using tools available to you to provide the user with relevant information that they ask for. You can also use the Google Lens API to get more information about the objects in the image. Use the google search tool to find relevant information only if the database doesn't have the information or you suspect that it doesn't.`;


// export const example_product_data = ```
// \`\`\`
// {
//   "product_name": "string - The name of the product",
//   "score": "number - The average rating (0-5)",
//   "image_url": "string - URL to the product image",
//   "general_review": "string - Comprehensive review of the product",
//   "amazon_reviews_ref": "array of URLs to relevant Amazon reviews",
//   "alternatives": [{
//     "name": "string - Name of alternative product",
//     "product_id": "string - ID of alternative product",
//     "score": "number - Rating of alternative product"
//   }],
//   "prices": {
//     "min": "number - Minimum price",
//     "avg": "number - Average price"
//   },
//   "product_id": "string - Unique product identifier",
//   "category": "string - Product category path"
// }
// \`\`\`
// ```;