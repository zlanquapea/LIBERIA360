import { NotFoundException } from "@nestjs/common";
import { FaqService } from "./faq.service";

function setup(rows: any[] = []) {
  const store = [...rows];
  const faqs = {
    find: jest.fn(async (opts: any) => {
      let result = [...store];
      if (opts?.where?.published !== undefined)
        result = result.filter((r) => r.published === opts.where.published);
      if (opts?.where?.id?.type === "in")
        result = result.filter((r) => opts.where.id.value.includes(r.id));
      return result;
    }),
    findOne: jest.fn(
      async ({ where: { id } }: any) => store.find((r) => r.id === id) ?? null,
    ),
    count: jest.fn(async () => store.length),
    create: jest.fn((value: any) => ({ ...value })),
    save: jest.fn(async (value: any) => {
      if (Array.isArray(value)) {
        value.forEach((v) => {
          const idx = store.findIndex((r) => r.id === v.id);
          if (idx >= 0) store[idx] = v;
        });
        return value;
      }
      if (!value.id) value.id = `faq-${store.length + 1}`;
      const idx = store.findIndex((r) => r.id === value.id);
      if (idx >= 0) store[idx] = value;
      else store.push(value);
      return value;
    }),
    delete: jest.fn(async (id: string) => {
      const idx = store.findIndex((r) => r.id === id);
      if (idx >= 0) store.splice(idx, 1);
    }),
  } as any;
  return { faqs, store, service: new FaqService(faqs) };
}

describe("FaqService", () => {
  it("only returns published FAQs from findPublished", async () => {
    const { service } = setup([
      { id: "1", published: true, sortOrder: 0 },
      { id: "2", published: false, sortOrder: 1 },
    ]);
    const result = await service.findPublished();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("defaults a new FAQ's sortOrder to the end of the list", async () => {
    const { service, faqs } = setup([{ id: "1", sortOrder: 0 }]);
    const created = await service.create({
      question: "Is this thing on?",
      answer: "Yes.",
    });
    expect(created.sortOrder).toBe(2); // existing count (1) + 1
    expect(faqs.save).toHaveBeenCalled();
  });

  it("respects an explicit sortOrder on create", async () => {
    const { service } = setup();
    const created = await service.create({
      question: "Q",
      answer: "A",
      sortOrder: 7,
    });
    expect(created.sortOrder).toBe(7);
  });

  it("throws when updating a FAQ that does not exist", async () => {
    const { service } = setup();
    await expect(
      service.update("missing", { question: "x" } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reorders by the given id sequence, ignoring FAQs not included", async () => {
    const { service, store } = setup([
      { id: "a", sortOrder: 5 },
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 9 },
    ]);
    await service.reorder({ ids: ["c", "a"] });
    expect(store.find((r) => r.id === "c")!.sortOrder).toBe(0);
    expect(store.find((r) => r.id === "a")!.sortOrder).toBe(1);
    expect(store.find((r) => r.id === "b")!.sortOrder).toBe(1); // untouched
  });

  it("rejects a reorder that references an id that does not exist", async () => {
    const { service } = setup([{ id: "a", sortOrder: 0 }]);
    await expect(
      service.reorder({ ids: ["a", "ghost"] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
