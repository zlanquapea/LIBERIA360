import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import {
  AdminKnowledgeBaseController,
  KnowledgeBaseController,
} from "./knowledge-base.controller";
import { KnowledgeBaseService } from "./knowledge-base.service";
import { ArticleFeedback } from "./entities/article-feedback.entity";
import { KnowledgeArticle } from "./entities/knowledge-article.entity";
import { KnowledgeCategory } from "./entities/knowledge-category.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      KnowledgeCategory,
      KnowledgeArticle,
      ArticleFeedback,
    ]),
  ],
  controllers: [KnowledgeBaseController, AdminKnowledgeBaseController],
  providers: [KnowledgeBaseService],
})
export class KnowledgeBaseModule {}
