import { BaseChatMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';

export class ConversationMemory implements BaseChatMemory {
    chatHistory: ChatMessageHistory;
    returnMessages: boolean;
    inputKey?: string;
    outputKey?: string;
    memoryKey: string = "history";
    
    constructor() {
        this.chatHistory = new ChatMessageHistory();
        this.returnMessages = true;
    }
    
    get memoryKeys(): string[] {
        return [this.memoryKey];
    }
    
    async loadMemoryVariables(_values: Record<string, any>) {
        const messages = await this.chatHistory.getMessages();
        if (this.returnMessages) {
            return { [this.memoryKey]: messages };
        }
        return { [this.memoryKey]: messages.map((message) => message.content).join("\n") };
    }
    
    async saveContext(
        inputValues: Record<string, any>,
        outputValues: Record<string, any>
    ): Promise<void> {
        const input = this.inputKey ? inputValues[this.inputKey] : inputValues.input;
        const output = this.outputKey
            ? outputValues[this.outputKey]
            : outputValues.output || outputValues.response;
        
        await this.chatHistory.addUserMessage(input);
        await this.chatHistory.addAIMessage(output);
    }
    
    async clear(): Promise<void> {
        await this.chatHistory.clear();
    }
}
