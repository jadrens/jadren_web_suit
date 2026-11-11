import { create } from "@bufbuild/protobuf";
import type { HandlerContext } from "@connectrpc/connect";
import { describe, expect, test } from "bun:test";
import { ListWordIdsRequestSchema } from "@gen/jadren/v1/vocabulary_pb";
import { vocabularyDrillService } from "./vocabulary";

describe("vocabulary dataset validation", () => {
  test("rejects inherited object properties as invalid datasets", async () => {
    for (const dataset of ["toString", "constructor", "__proto__", "unknown"]) {
      const request = create(ListWordIdsRequestSchema, { dataset, mode: "word" });
      await expect(vocabularyDrillService.listWordIds!(request, {} as HandlerContext))
        .rejects.toMatchObject({ message: expect.stringContaining("invalid_dataset") });
    }
  });
});
