import { KeyInput, Page } from "puppeteer";

const WAIT_ROOM_ACTION_INTERVAL = 600;

export class Player {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  public async queueGame() {
    // Join a game queue
    
    // console.log("JOINING GAME");
    // await this.page.keyboard.press("j");

    const viewport = this.page.viewport();
    if (!viewport) {
      throw new Error("Viewport is null");
    }

    // Calculate the click position
    const clickX = viewport.width * 0.58;
    const clickY = viewport.height * 0.89;

    // Join a game queue
    console.log("JOINING GAME");
    await this.page.mouse.click(clickX, clickY, { delay: 650 });
    await this.page.mouse.click(clickX, clickY, { delay: 650 });
  }

  public async waitroom(waitRoomTime: number, cutSceneTime: number) {
    console.log("Playing around in waitroom");

    // Set an interval to take a move every actionIntervalMs
    const moveInterval = setInterval(
      async () => await this.moveAllDirections(WAIT_ROOM_ACTION_INTERVAL),
      WAIT_ROOM_ACTION_INTERVAL
    );

    // Wait for waitroom to finish
    console.log("Waiting for waitroom to finish");
    await new Promise((r) =>
      setTimeout(() => {
        clearInterval(moveInterval);
        console.log("Done waiting in waitroom");
        r(true);
      }, waitRoomTime)
    );

    // Do nothing while cutscene is playing
    console.log("Waiting for cutscene to finish");
    await new Promise((r) => setTimeout(r, cutSceneTime));
    console.log("Done waiting for cutscene to finish");
  }

  public async race(intervalMs: number, lifeSpanMs: number) {
    // always move forward
    await this.page.keyboard.down("w");

    // Set an interval to move every ACTION_INTERVAL ms
    const moveInterval = setInterval(async () => {
      await this.moveSideways(intervalMs);
    }, intervalMs);

    // Let the bot run for its lifespan
    await new Promise((r) => setTimeout(r, lifeSpanMs));

    // Kill the bot
    clearInterval(moveInterval);
    await this.page.keyboard.up("w");
  }

  async moveAllDirections(lenMs: number) {
    // Randomly move forward or backwards
    const keys: KeyInput[] = ["w", "s"];
    const keyToPress = keys[Math.floor(Math.random() * keys.length)];
    await this.page.keyboard.down(keyToPress);

    // Maybe press 'Space' to jump
    if (Math.random() >= 0.75) {
      await this.page.keyboard.press("Space");
    }

    // Maybe randomly press 'a' or 'd' for left or right
    if (Math.random() >= 0.5) {
      const keys: KeyInput[] = ["a", "d"];
      const keyToPress = keys[Math.floor(Math.random() * keys.length)];
      await this.page.keyboard.press(keyToPress, { delay: lenMs - 50 });
    }

    await this.page.keyboard.up(keyToPress);
  }

  async moveForwards(lenMs: number) {
    // always move forward
    await this.page.keyboard.down("w");

    // Maybe press 'Space' to jump
    if (Math.random() >= 0.5) {
      await this.page.keyboard.press("Space");
    }

    // Maybe randomly press 'a' or 'd' for left or right
    if (Math.random() >= 0.5) {
      const keys: KeyInput[] = ["a", "d"];
      const keyToPress = keys[Math.floor(Math.random() * keys.length)];
      await this.page.keyboard.press(keyToPress, { delay: lenMs - 100 });
    }

    await this.page.keyboard.up("w");
  }

  async moveSideways(lenMs: number) {
    // Maybe press 'Space' to jump
    if (Math.random() >= 0.5) {
      await this.page.keyboard.press("Space");
    }

    // Maybe randomly press 'a' or 'd' for left or right
    if (Math.random() >= 0.5) {
      const keys: KeyInput[] = ["a", "d"];
      const keyToPress = keys[Math.floor(Math.random() * keys.length)];
      await this.page.keyboard.press(keyToPress, { delay: lenMs - 100 });
    }
  }
}
