import fs from "fs";
import { Page } from "puppeteer";
import { sleep } from "./utils";

export class Client {
  page: Page;
  screenshotDir?: string;
  screenshotInterval?: NodeJS.Timeout;

  constructor(page: Page) {
    this.page = page;
  }

  public async init() {
    await this.closeSpam();
    await this.enterDragToRotate();
  }

  public startCapture(
    screenShotsDirectory: string,
    screenShotInterval: number
  ) {
    // Create a folder for this instance
    const instance = new Date().toISOString().replace(/[:\.]/g, "-");
    this.screenshotDir = `${screenShotsDirectory}/${instance}`;
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    // start taking screenshots
    this.screenshotInterval = setInterval(async () => {
      await this.takeScreenShot();
    }, screenShotInterval);
  }

  public endCapture() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
    }
  }

  private async closeSpam() {
    // Set timeout so we don't loop infinitely
    const timeout = setTimeout(() => {
      throw new Error("Timeout: Could not find avatar selection button");
    }, 120000);

    // Keep checking DOM if spam element exists. Once it's there, close it.
    // Get rid of the character selection screen
    console.log("removing character selection screen");
    while (true) {
      const isFound = await this.page.evaluate((text) => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const targetButton = buttons.find((button) =>
          button.textContent?.includes(text)
        );
        if (targetButton) {
          targetButton.click();
          return true;
        }
      }, "Continue");
      if (isFound) {
        break;
      }
    }

    // Get rid of the tutorial screen
    console.log("removing tutorial screen");
    while (true) {
      const isFound = await this.page.evaluate((text) => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const targetButton = buttons.find((button) =>
          button.textContent?.includes(text)
        );
        if (targetButton) {
          targetButton.click();
          return true;
        }
      }, "Skip");
      if (isFound) {
        break;
      }
    }

    clearTimeout(timeout);
  }

  private async enterDragToRotate() {
    // Set timeout so we don't loop infinitely
    const timeout = setTimeout(() => {
      throw new Error("Timeout: Could not enter drag to rotate");
    }, 120000);

    // Keep checking DOM if button exists. Once it's there, close it.
    // Loop until we can find the button
    console.log("entering drag to rotate");
    while (true) {
      await this.page.keyboard.press("g", { delay: 250 });
      const isFound = await this.page.evaluate((text) => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const targetButton = buttons.find((button) =>
          button.textContent?.includes(text)
        );
        if (targetButton) {
          targetButton.click();
          return true;
        }
      }, "Drag to Rotate");
      if (isFound) {
        break;
      }
    }

    clearTimeout(timeout);
  }

  private async takeScreenShot() {
    const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
    const screenshotPath = `${this.screenshotDir}/screenshot-${timestamp}.png`;
    await this.page.screenshot({ path: screenshotPath });
    console.log(`Screenshot taken and saved as ${screenshotPath}`);
  }
}
