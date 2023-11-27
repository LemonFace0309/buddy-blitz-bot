import fs from "fs";
import path from "path";

import "dotenv/config";
import OpenAI from "openai";
import { KeyInput, Page } from "puppeteer";

import { nonBlockingWhile, sleep } from "./utils";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PROMPT = fs.readFileSync(
  path.join(process.cwd(), "src", "prompt.txt"),
  "utf-8"
);

type RandomAction = "left" | "right" | "forward" | "backwards";
type ControlledAction = "jump";

type RandomActionProbabilities = Record<RandomAction, number>;
type ControlledActionProbabilities = Record<ControlledAction, number>;

type ActionProbabilities = RandomActionProbabilities &
  ControlledActionProbabilities;

enum PlayerState {
  Idle,
  Degen,
  Racing,
  RacingWithGpt4,
}

type Direction = "w" | "a" | "s" | "d";

export class Player {
  page: Page;
  openai: OpenAI;
  currentDirection: Direction;
  currentState: PlayerState;

  constructor(page: Page) {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not defined");
    }

    this.page = page;
    this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    this.currentDirection = "w";
    this.currentState = PlayerState.Idle;
  }

  public async queueGame() {
    // Join a game queue

    console.log("QUEUEING GAME");
    await this.page.keyboard.press("j", { delay: 500 });

    // const viewport = this.page.viewport();
    // if (!viewport) {
    //   throw new Error("Viewport is null");
    // }

    // // Calculate the click position
    // const clickX = viewport.width * 0.58;
    // const clickY = viewport.height * 0.89;

    // // Join a game queue
    // console.log("JOINING GAME");
    // await this.page.mouse.click(clickX, clickY, { delay: 650 });
    // await this.page.mouse.click(clickX, clickY, { delay: 650 });
  }

  public async idle() {
    console.log("Idle");
    this.currentState = PlayerState.Idle;
  }

  public async degen() {
    console.log("Degen");
    this.currentState = PlayerState.Degen;
    nonBlockingWhile(
      () => this.currentState == PlayerState.Degen,
      async () => {
        // Randomly move forward or backwards
        const keys: KeyInput[] = ["w", "s"];
        const keyToPress = keys[Math.floor(Math.random() * keys.length)];
        await this.page.keyboard.down(keyToPress);

        // Maybe press 'Space' to jump
        if (Math.random() >= 0.5) {
          await this.page.keyboard.press("Space");
        }

        // Maybe randomly press 'a' or 'd' for left or right
        if (Math.random() >= 0.5) {
          const keys: KeyInput[] = ["a", "d"];
          const keyToPress = keys[Math.floor(Math.random() * keys.length)];
          await this.page.keyboard.press(keyToPress, { delay: 300 });
        }

        await this.page.keyboard.up(keyToPress);
      }
    );
  }

  public async claimRewards() {
    console.log("Rewards Screen");
    this.currentState = PlayerState.Idle;
    nonBlockingWhile(
      () => this.currentState == PlayerState.Idle,
      async () => {
        // close sign up banner if it exists
        await this.page.evaluate(() => {
          const buttons = Array.from(
            document.querySelectorAll("button:has(svg)")
          ) as Array<HTMLButtonElement | undefined>;
          const targetButton = buttons.find(
            (button) =>
              button?.classList.contains("absolute") &&
              button?.classList.contains("-right-3") &&
              button?.classList.contains("-top-3")
          );
          if (targetButton) {
            targetButton.click();
          }
        });
        // await this.page.mouse.click(645, 530, { delay: 500 });

        // click continue
        await this.page.mouse.click(390, 555, { delay: 500 });
        await this.page.mouse.click(390, 555, { delay: 500 });
      }
    );
  }

  public async race(intervalMs: number) {
    console.log("RUNNING FORWARDS");
    this.currentState = PlayerState.Racing;
    this.currentDirection = "w";
    nonBlockingWhile(
      () => this.currentState == PlayerState.Racing,
      async () => {
        await this.run(intervalMs);
      }
    );
  }

  public async raceWithGpt4(intervalMs: number) {
    console.log("RACING WITH GPT-4");
    this.currentState = PlayerState.RacingWithGpt4;
    this.currentDirection = "w";

    // run in this.currentDirection
    nonBlockingWhile(
      () => this.currentState == PlayerState.RacingWithGpt4,
      async () => {
        await this.run(2000);
      }
    );

    // prompt gpt-4 to change this.currentDirection
    nonBlockingWhile(
      () => this.currentState == PlayerState.RacingWithGpt4,
      async () => {
        const screenshotBase64 = await this.page.screenshot({
          encoding: "base64",
          type: "jpeg",
        });

        const dir = await this.getNewDirection(screenshotBase64);

        if (!dir) {
          console.log("Failed to get direction from AI");
          this.currentDirection = "w";
        } else {
          this.currentDirection = dir;
        }

        await sleep(intervalMs);
      }
    );
  }

  private async run(durationMs: number) {
    await this.page.keyboard.down(this.currentDirection);

    // Maybe press 'Space' to jump
    if (Math.random() >= 0.6) {
      await this.page.keyboard.press("Space", { delay: 250 });
      await this.page.mouse.click(100, 100, {
        button: "right",
        delay: 650,
      });
    }

    // Maybe randomly press 'a' or 'd' for left or right
    if (Math.random() >= 0.6 && ["w", "s"].includes(this.currentDirection)) {
      const keys: KeyInput[] = ["a", "d"];
      const keyToPress = keys[Math.floor(Math.random() * keys.length)];
      await this.page.keyboard.press(keyToPress, { delay: durationMs });
    } else {
      await sleep(durationMs);
    }

    await this.page.keyboard.up(this.currentDirection);
  }

  private selectAction(probabilities: RandomActionProbabilities): RandomAction {
    const entries = Object.entries(probabilities) as Array<
      [RandomAction, number]
    >;

    let totalProb = 0;
    const probArray: Array<[RandomAction, number]> = [];

    for (const [key, value] of entries) {
      totalProb += value;
      probArray.push([key, totalProb]);
    }

    const random = Math.random() * totalProb;
    for (const [key, prob] of probArray) {
      if (random <= prob) {
        return key;
      }
    }
    return probArray[probArray.length - 1][0];
  }

  private async getNewDirection(
    screenshotBase64: string
  ): Promise<Direction | undefined> {
    console.log("Prompting GPT-4 Vision");
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        max_tokens: 512,
        messages: [
          {
            role: "system",
            content:
              "You are a bot for Buddy Blitz, a simulation I'm developed. You are designed to output JSON, and only JSON.",
          },
          {
            role: "system",
            content:
              "I've taken a screenshot of what the current screen looks like. You are controlling ths white avatar in the centre of the screen.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${screenshotBase64}`,
                },
              },
            ],
          },
        ],
      });

      const content = response.choices[0].message.content;
      if (!content) {
        console.log("Failed to get response from AI");
        return undefined;
      } else {
        console.log("AI RESPONSE:", content);
      }
      let jsonContent = content.substring(
        content.indexOf("{"),
        content.indexOf("}") + 1
      );
      jsonContent.replaceAll("\\", "");

      const possibleActions = JSON.parse(jsonContent);
      const selectedAction = this.selectAction(possibleActions);

      console.log("SELECTED ACTION:", selectedAction);
      let dir: Direction | undefined;
      switch (selectedAction) {
        case "left":
          dir = "a";
          break;
        case "right":
          dir = "d";
          break;
        case "forward":
          dir = "w";
          break;
        case "backwards":
          dir = "s";
          break;
        default:
          dir = undefined;
          console.log("Received invalid action:", selectedAction);
      }
      return dir;
    } catch (err) {
      console.log("Error with GPT-4 Vision:", err);
      return undefined;
    }
  }
}
