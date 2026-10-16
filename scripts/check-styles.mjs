import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Check the HTML/CSS integration that compilation alone cannot validate.
// In particular, CSS loaders can emit styles while losing module class exports.
const buildRoot = path.resolve(".next");
const routes = [
  { file: "index", label: "/", featureTag: /<section\b[^>]*aria-labelledby="hero-heading"[^>]*>/ },
  { file: "design-system", label: "/design-system", featureTag: /<main\b[^>]*>/ },
];

for (const route of routes) {
  const html = await readFile(path.join(buildRoot, "server/app", `${route.file}.html`), "utf8");
  const stylesheets = [...html.matchAll(/<link\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => /\brel="stylesheet"/.test(tag))
    .map((tag) => /\bhref="([^"]+)"/.exec(tag)?.[1]);
  assert(stylesheets.length > 0, `${route.label}: no linked stylesheets`);

  const css = (await Promise.all(stylesheets.map(async (href) => {
    assert(href?.startsWith("/_next/static/"), `${route.label}: unexpected stylesheet ${href}`);
    return readFile(path.join(buildRoot, href.slice("/_next/".length)), "utf8");
  }))).join("\n");

  assert(/--canvas\s*:/.test(css), `${route.label}: design tokens are missing`);
  assert(css.includes(".button--primary"), `${route.label}: shared button styles are missing`);

  for (const [label, pattern] of [["header", /<header\b[^>]*>/], ["feature", route.featureTag]]) {
    const tag = pattern.exec(html)?.[0];
    assert(tag, `${route.label}: ${label} was not rendered`);
    const classes = /\bclass="([^"]+)"/.exec(tag)?.[1]?.split(/\s+/) ?? [];
    assert(classes.length > 0, `${route.label}: ${label} lost its CSS Module class exports`);
    for (const className of classes) {
      const escaped = className.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
      assert(css.includes(`.${escaped}`), `${route.label}: no linked CSS for ${className}`);
    }
  }

  console.log(`${route.label}: module classes, linked CSS, tokens, and shared controls verified`);
}
