import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Creator } from "./entities/creator.entity";
import { CreatorPortfolioItem } from "./entities/creator-portfolio-item.entity";
import { CreatorOffering } from "./entities/creator-offering.entity";
import { CreatorFollow } from "./entities/creator-follow.entity";
import { CreatorPost } from "./entities/creator-post.entity";
import {
  CreatorStory,
  CreatorStoryReport,
  CreatorStoryView,
} from "./entities/creator-story.entity";
import {
  CreatorPostComment,
  CreatorPostCommentLike,
  CreatorPostLike,
  CreatorPostSave,
} from "./entities/creator-post-interaction.entity";
import { CreatorsService } from "./creators.service";
import { CreatorsController } from "./creators.controller";
import { CreatorFeedService } from "./creator-feed.service";
import { CreatorFeedController } from "./creator-feed.controller";
import { CreatorStoriesService } from "./creator-stories.service";
import { CreatorStoriesController } from "./creator-stories.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Creator,
      CreatorPortfolioItem,
      CreatorOffering,
      CreatorFollow,
      CreatorPost,
      CreatorPostLike,
      CreatorPostSave,
      CreatorPostComment,
      CreatorPostCommentLike,
      CreatorStory,
      CreatorStoryView,
      CreatorStoryReport,
    ]),
  ],
  controllers: [
    CreatorFeedController,
    CreatorsController,
    CreatorStoriesController,
  ],
  providers: [CreatorsService, CreatorFeedService, CreatorStoriesService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
