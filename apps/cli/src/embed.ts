/// <reference lib="DOM" />

import { Page } from "playwright";

export async function injectEditor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window !== window.parent) return;
    window.addEventListener(
      "DOMContentLoaded",
      () => {
        const script = document.createElement("script");
        script.src = "http://localhost:3030/editor.js";
        document.body.appendChild(script);

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "http://localhost:3030/editor.css";
        document.head.appendChild(link);
      },
      false
    );
  });
}
