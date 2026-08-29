import { Body, Controller, Get, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Throttle, seconds } from "@nestjs/throttler";
import { AssistantService } from "./assistant.service";
import { AskAssistantDto } from "./dto/ask-assistant.dto";
import { CreateAssistantFeedbackDto } from "./dto/assistant-feedback.dto";

@ApiTags("assistant")
@Controller("assistant")
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get("prompts")
  @ApiOperation({ summary: "List approved LIBERIA360 assistant quick prompts" })
  getQuickPrompts() {
    return { prompts: this.assistantService.getQuickPrompts() };
  }

  @Post("ask")
  @HttpCode(200)
  @Throttle({ default: { limit: 12, ttl: seconds(60) } })
  @ApiOperation({ summary: "Ask the LIBERIA360 product assistant a question" })
  @ApiResponse({ status: 200, description: "A safe product-guidance answer" })
  @ApiResponse({ status: 429, description: "Too many assistant requests" })
  ask(@Body() input: AskAssistantDto) {
    return this.assistantService.ask(input);
  }

  @Post("feedback")
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @ApiOperation({ summary: "Record feedback about an assistant answer" })
  recordFeedback(@Body() input: CreateAssistantFeedbackDto) {
    return this.assistantService.recordFeedback(input);
  }
}
