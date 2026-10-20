import { test } from "node:test";
import assert from "node:assert/strict";
import { renderExistingWorld } from "../tools/concepts/existing-worlds.mjs";

for (const id of ["polar", "candy"]) {
  test(`${id}: existing art renders a complete animated concept scene`, () => {
    const first = renderExistingWorld(id, 0);
    const later = renderExistingWorld(id, 8);
    assert.deepEqual([first.width, first.height], [320, 180]);
    assert.equal(first.data.length, 320 * 180 * 4);
    for (let i = 3; i < first.data.length; i += 4) assert.equal(first.data[i], 255, "the scene has no unpainted gaps");
    assert.ok(!first.data.equals(later.data), "scene sprites and environment move over time");
    assert.ok(first.data.equals(renderExistingWorld(id, 0).data), "revisiting a scene renders the same starting frame");
  });
}
