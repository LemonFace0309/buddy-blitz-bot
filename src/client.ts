import fs from "fs";
import { Page } from "puppeteer";


export class Client {
  page: Page;
  screenshotDir?: string;
  screenshotInterval?: NodeJS.Timeout;

  constructor(page: Page) {
    this.page = page;
  }

  public async init() {
    await this.closeSpam();
  }

  public startCapture(screenShotsDirectory: string, screenShotInterval: number) {
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

  async closeSpam() {
    // Get rid of the character selection screen
    console.log("removing character selection screen");
    // await page.mouse.click(100, 100)
    await this.page
      .locator("button[type=submit]")
      .filter((button) => button.textContent == "Continue")
      .click();
    await new Promise((r) => setTimeout(r, 500));

    // Get rid of the tutorial screen
    console.log("removing tutorial screen");
    await this.page
      .locator("button")
      .filter((button) => button.textContent == "Skip")
      .click();
    await new Promise((r) => setTimeout(r, 500));
  }

  async takeScreenShot() {
    const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
    const screenshotPath = `${this.screenshotDir}/screenshot-${timestamp}.png`;
    await this.page.screenshot({ path: screenshotPath });
    console.log(`Screenshot taken and saved as ${screenshotPath}`);
  }
}
