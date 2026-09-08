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
  // Order matters: Nest/Express matches routes in controller-registration
  // order, and CreatorsController's `@Get(":username")` is a single-
  // segment catch-all under this same "creators" prefix. It must come
  // AFTER every other single-segment "creators/<literal>" route (feed,
  // stories, ...) or it swallows them first — e.g. `GET /creators/stories`
  // would 404 as "Creator \"stories\" not found" instead of ever reaching
  // CreatorStoriesController.listActive. (Bug found + fixed Sep 8, 2026:
  // this made the entire public story tray silently return nothing, since
  // it's exactly the route the frontend's story tray fetches — see the
  // same protection CreatorFeedController's "feed"/"saved"/"posts" routes
  // already relied on by being listed first.)
  controllers: [
    CreatorFeedController,
    CreatorStoriesController,
    CreatorsController,
  ],
  providers: [CreatorsService, CreatorFeedService, CreatorStoriesService],
  exports: [CreatorsService],
})
export class CreatorsModule {}
