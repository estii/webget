import { chromium, type Browser } from "playwright";

const channel = "chrome";

let headedBrowser: Promise<Browser> | null = null;
function getHeadedBrowser() {
  if (headedBrowser === null) {
    headedBrowser = chromium.launch({ headless: false, channel });
  }
  return headedBrowser;
}

let headlessBrowser: Promise<Browser> | null = null;
function getHeadlessBrowser() {
  if (headlessBrowser === null) {
    headlessBrowser = chromium.launch({ headless: true, channel });
  }
  return headlessBrowser;
}

export async function getBrowser(headless = true) {
  if (headless) {
    return getHeadlessBrowser();
  }
  return getHeadedBrowser();
}
