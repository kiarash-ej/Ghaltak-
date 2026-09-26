import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardTitle } from "./card";

// #52: a card title is an h2 by default (right under the page's h1), h3 when
// the card sits inside a section with its own h2.
describe("CardTitle", () => {
  it("is an h2 by default and an h3 when asked, with the same look", () => {
    const h2 = renderToStaticMarkup(createElement(CardTitle, null, "سفارش"));
    const h3 = renderToStaticMarkup(createElement(CardTitle, { as: "h3" }, "سفارش"));
    expect(h2).toMatch(/^<h2 class="text-lg font-semibold leading-none">سفارش<\/h2>$/);
    expect(h3).toMatch(/^<h3 class="text-lg font-semibold leading-none">سفارش<\/h3>$/);
  });
});
