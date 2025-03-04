import { BaseChatMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { AIMessage } from '@langchain/core/messages';

export class ConversationMemory implements BaseChatMemory {
    private static memories = new Map<string, ConversationMemory>();
    chatHistory: ChatMessageHistory;
    returnMessages: boolean;
    inputKey?: string;
    outputKey?: string;
    memoryKey: string = "history";
    
    private constructor() {
        this.chatHistory = new ChatMessageHistory();
        this.returnMessages = true;
    }

    static getMemory(userId: string): ConversationMemory {
        if (!this.memories.has(userId)) {
            this.memories.set(userId, new ConversationMemory());
        }
        return this.memories.get(userId)!;
    }

    static clearMemory(userId: string): void {
        const memory = this.memories.get(userId);
        if (memory) {
            memory.clear();
        }
    }

    async initializeWithProductContext(productData: any): Promise<void> {
        await this.clear();
        const contextMessage = new AIMessage({
            content: JSON.stringify(productData)
        });
        await this.chatHistory.addMessage(contextMessage);
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
