import { DynamicTool, DynamicStructuredTool, StructuredTool } from 'langchain/tools';
import { OpenAIEmbeddings } from '@langchain/openai';

export type GraphRagTool = DynamicTool | StructuredTool | DynamicStructuredTool;
export type GraphRagTools = GraphRagTool[];

export interface ToolDependencies {
    embeddingsModel: OpenAIEmbeddings;
}
