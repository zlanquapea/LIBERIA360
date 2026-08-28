import { CreatorFeedService } from "./creator-feed.service";
import { CreatorPostCommentLike } from "./entities/creator-post-interaction.entity";

function createService() {
  const post = { id: "post-1", status: "published", commentCount: 0 };
  const parent = { id: "parent-1", postId: post.id };
  const comment = {
    id: "comment-1",
    postId: post.id,
    userId: "user-1",
    parentId: parent.id,
    body: "A useful reply",
    likeCount: 0,
  };
  const postRepo = {
    findOne: jest.fn().mockResolvedValue(post),
    save: jest.fn().mockResolvedValue(post),
  };
  const commentRepo = {
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: { id?: string } }) => {
        if (where.id === parent.id) return Promise.resolve(parent);
        if (where.id === comment.id) return Promise.resolve(comment);
        return Promise.resolve(null);
      }),
    create: jest.fn().mockReturnValue(comment),
    save: jest.fn().mockResolvedValue(comment),
    findOneOrFail: jest.fn().mockResolvedValue(comment),
  };
  const commentLikeRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((value) => value),
    save: jest.fn().mockResolvedValue({
      id: "comment-like-1",
      commentId: comment.id,
      userId: "user-1",
    } satisfies Partial<CreatorPostCommentLike>),
    remove: jest.fn(),
  };
  const service = new CreatorFeedService(
    {} as never,
    postRepo as never,
    {} as never,
    {} as never,
    commentRepo as never,
    commentLikeRepo as never,
    {} as never,
  );
  return { service, postRepo, commentRepo, commentLikeRepo, parent, comment };
}

describe("CreatorFeedService comment interactions", () => {
  it("creates a reply linked to a comment on the same post", async () => {
    const { service, commentRepo, postRepo, parent } = createService();

    await service.addComment("user-1", "post-1", {
      body: "A useful reply",
      parentId: parent.id,
    });

    expect(commentRepo.create).toHaveBeenCalledWith({
      postId: "post-1",
      userId: "user-1",
      body: "A useful reply",
      parentId: parent.id,
    });
    expect(postRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ commentCount: 1 }),
    );
  });

  it("adds a comment like and returns the updated count", async () => {
    const { service, commentRepo, commentLikeRepo, comment } = createService();

    const result = await service.toggleCommentLike(
      "user-1",
      "post-1",
      comment.id,
    );

    expect(commentLikeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ commentId: comment.id, userId: "user-1" }),
    );
    expect(commentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: comment.id, likeCount: 1 }),
    );
    expect(result).toEqual({ liked: true, likeCount: 1 });
  });
});
