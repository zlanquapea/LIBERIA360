import {
  collectionItem,
  collectionShareUrl,
  readSharedCollection,
} from "./collections";
it("shares and restores a collection snapshot without storage or sign-in", () => {
  const collection = {
    id: "private-id",
    name: "Beach weekend",
    items: [{ title: "Robertsport", path: "/places/robertsport" }],
  };
  const link = collectionShareUrl(collection, "https://liberia360.net");
  expect(link).not.toContain("private-id");
  expect(readSharedCollection(new URL(link).hash)).toEqual({
    ...collection,
    id: "shared",
  });
});
it("rejects external URLs and tampered snapshots", () => {
  expect(collectionItem("Bad", "javascript:alert(1)")).toBeNull();
  expect(collectionItem("Bad", "https://example.com/places/a")).toBeNull();
  expect(
    readSharedCollection(
      encodeURIComponent(
        JSON.stringify({
          name: "Bad",
          items: [{ title: "Bad", path: "//example.com" }],
        }),
      ),
    ),
  ).toBeNull();
  expect(readSharedCollection("#broken")).toBeNull();
});
