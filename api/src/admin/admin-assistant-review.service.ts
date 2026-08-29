import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  AssistantFeedback,
  AssistantFeedbackType,
} from "../assistant/entities/assistant-feedback.entity";

@Injectable()
export class AdminAssistantReviewService {
  constructor(
    @InjectRepository(AssistantFeedback)
    private readonly feedbackRepo: Repository<AssistantFeedback>,
  ) {}

  async getQueue(limit = 100) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 250);
    const records = await this.feedbackRepo.find({
      order: { createdAt: "DESC" },
      take: safeLimit,
    });
    const counts = records.reduce(
      (result, record) => {
        result[record.type] = (result[record.type] ?? 0) + 1;
        return result;
      },
      {
        [AssistantFeedbackType.UNANSWERED]: 0,
        [AssistantFeedbackType.INCORRECT]: 0,
        [AssistantFeedbackType.NOT_HELPFUL]: 0,
        [AssistantFeedbackType.HELPFUL]: 0,
      } as Record<AssistantFeedbackType, number>,
    );
    const questionGroups = new Map<
      string,
      { question: string; count: number; latestAt: Date }
    >();
    for (const record of records) {
      const key = record.question.trim().toLowerCase();
      const existing = questionGroups.get(key);
      if (existing) existing.count += 1;
      else
        questionGroups.set(key, {
          question: record.question,
          count: 1,
          latestAt: record.createdAt,
        });
    }

    return {
      data: records,
      counts,
      topQuestions: [...questionGroups.values()]
        .sort(
          (a, b) =>
            b.count - a.count || b.latestAt.getTime() - a.latestAt.getTime(),
        )
        .slice(0, 10),
      meta: { limit: safeLimit, returned: records.length },
    };
  }
}
