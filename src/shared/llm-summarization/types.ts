export interface LlmClient {
  complete(params: {
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<string>;
}

export interface SummarizationInput {
  system_prompt: string;
  user_prompt: string;
  max_tokens?: number;
}

export interface SummarizationOutput {
  raw_text: string;
  model_used: string;
  generated_at: string;
}
