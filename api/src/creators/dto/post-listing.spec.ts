import { validate } from "class-validator";
import { CreateCreatorPostDto } from "./create-creator-post.dto";
import { UpdateCreatorPostDto } from "./update-creator-post.dto";
it.each([CreateCreatorPostDto, UpdateCreatorPostDto])(
  "validates listing tags in %p",
  async (Dto) => {
    const dto = Object.assign(new Dto(), {
      mediaType: "text",
      mediaUrl: "",
      caption: "Visit Liberia",
      relatedPath: "/places/robertsport",
      relatedLabel: "Robertsport",
    });
    expect(await validate(dto)).toHaveLength(0);
    dto.relatedPath = "https://evil.test";
    expect(
      (await validate(dto)).some((error) => error.property === "relatedPath"),
    ).toBe(true);
    dto.relatedPath = "";
    expect(await validate(dto)).toHaveLength(0);
    dto.relatedLabel = "x".repeat(101);
    expect(
      (await validate(dto)).some((error) => error.property === "relatedLabel"),
    ).toBe(true);
  },
);
