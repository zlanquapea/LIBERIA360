import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AssistantController } from "./assistant.controller";
import { AssistantService } from "./assistant.service";
import { AssistantFeedback } from "./entities/assistant-feedback.entity";

@Module({
  imports: [TypeOrmModule.forFeature([AssistantFeedback])],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
