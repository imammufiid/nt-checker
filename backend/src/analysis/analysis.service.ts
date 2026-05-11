import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { AnalysisResult } from './analysis.types';
import { SYSTEM_PROMPT, NUTRITION_TOOL } from './prompts';

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.',
      );
    }
    this.client = new Anthropic({ apiKey });
    this.model = config.get<string>('CLAUDE_MODEL', 'claude-sonnet-4-6');
    this.logger.log(`Using model: ${this.model}`);
  }

  async analyzeLabel(
    imagePath: string,
    mimeType: string,
  ): Promise<AnalysisResult> {
    const base64 = readFileSync(imagePath).toString('base64');
    const mediaType = this.normalizeMediaType(mimeType);

    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2048,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools: [
          {
            ...NUTRITION_TOOL,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tool_choice: {
          type: 'tool',
          name: 'extract_and_analyze_nutrition',
        },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: 'Analyze this nutrition label and return your analysis via the tool.',
              },
            ],
          },
        ],
      });
    } catch (err) {
      this.logger.error('Claude API call failed', err as Error);
      if (err instanceof Anthropic.APIError) {
        throw new InternalServerErrorException(
          `Analysis provider error: ${err.message}`,
        );
      }
      throw err;
    }

    const usage = response.usage;
    this.logger.log(
      `Usage — input: ${usage.input_tokens}, output: ${usage.output_tokens}, ` +
        `cache_read: ${usage.cache_read_input_tokens ?? 0}, ` +
        `cache_create: ${usage.cache_creation_input_tokens ?? 0}`,
    );

    const toolUse = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === 'tool_use',
    );

    if (!toolUse) {
      this.logger.warn('Model did not return a tool call');
      throw new UnprocessableEntityException(
        'Could not extract structured data from this image. Please try a clearer photo.',
      );
    }

    return toolUse.input as AnalysisResult;
  }

  private normalizeMediaType(
    mime: string,
  ): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
    if (mime === 'image/png') return 'image/png';
    if (mime === 'image/webp') return 'image/webp';
    if (mime === 'image/gif') return 'image/gif';
    return 'image/jpeg';
  }
}
