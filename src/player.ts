import fs from "fs";
import path from "path";

import { KeyInput, Page } from "puppeteer";
import OpenAI from "openai";
import "dotenv/config";

import { nonBlockingWhile, sleep } from "./utils";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const PROMPT = fs.readFileSync(
  path.join(process.cwd(), "src", "prompt.txt"),
  "utf-8"
);

type RandomAction =
  | "left"
  | "right"
  | "forward"
  | "left-forward"
  | "right-forward"
  | "backwards"
  | "nothing";
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

export class Player {
  page: Page;
  openai: OpenAI;
  currentState: PlayerState;

  constructor(page: Page) {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not defined");
    }

    this.page = page;
    this.currentState = PlayerState.Idle;
    this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
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
    nonBlockingWhile(() => this.currentState == PlayerState.Degen, async () => {
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
    });
  }

  public async claimRewards() {
    console.log("Rewards Screen");
    this.currentState = PlayerState.Idle;
    await sleep(15000);
    await this.page.mouse.click(500, 500, { delay: 500 });
    await this.page.mouse.click(500, 500, { delay: 500 });
    await this.page.mouse.click(500, 500, { delay: 500 });
  }

  public async race(intervalMs: number) {
    console.log("RUNNING FORWARDS");
    this.currentState = PlayerState.Racing;
    nonBlockingWhile(() => this.currentState == PlayerState.Racing, async () => {
      await this.page.keyboard.down("w");

      // Maybe press 'Space' to jump
      if (Math.random() >= 0.6) {
        await this.page.keyboard.press("Space", { delay: 250 });
        await this.page.mouse.click(100, 100, { button: "right", delay: 650 });
      }

      // Maybe randomly press 'a' or 'd' for left or right
      if (Math.random() >= 0.8) {
        const keys: KeyInput[] = ["a", "d"];
        const keyToPress = keys[Math.floor(Math.random() * keys.length)];
        await this.page.keyboard.press(keyToPress, { delay: intervalMs });
      } else {
        await sleep(intervalMs);
      }

      await this.page.keyboard.up("w");
    });
  }

  public async raceWithGpt4(intervalMs: number) {
    console.log("RACING WITH GPT-4");
    this.currentState = PlayerState.RacingWithGpt4;
    nonBlockingWhile(() => 
      this.currentState == PlayerState.RacingWithGpt4,
      async () => {
        const screenshotBase64 = await this.page.screenshot({
          encoding: "base64",
          type: "jpeg",
        });

        await this.page.keyboard.down("w");

        let response: OpenAI.Chat.Completions.ChatCompletion | undefined =
          undefined;

        const getResponse = async () => {
          response = await this.promptVisionGpt4(screenshotBase64);
        };
        const jumpAndSlide = async () => {
          await this.page.keyboard.press("Space", { delay: 250 });
          await this.page.mouse.click(100, 100, {
            button: "right",
            delay: 650,
          });
          await sleep(500);
        };
        await Promise.all([getResponse(), jumpAndSlide()]);

        if (typeof response == "undefined") {
          console.log("Failed to get response from AI");
          return;
        } else {
          response = response as OpenAI.Chat.Completions.ChatCompletion;
          console.log("AI RESPONSE:", response);
        }

        console.log("RESPONSE:");
        console.dir(response, { depth: 8 });

        const content = response.choices[0].message.content;
        if (!content) {
          console.log("Failed to get response from AI");
          return;
        } else {
          console.log("AI RESPONSE:", content);
        }

        let jsonContent = content.substring(
          content.indexOf("{"),
          content.indexOf("}") + 1
        );
        jsonContent.replaceAll("\\", "");

        let possibleActions: ActionProbabilities;
        try {
          possibleActions = JSON.parse(jsonContent);
        } catch (err) {
          console.log("Failed to parse JSON:", jsonContent);
          return;
        }
        const jump = possibleActions.jump;
        const selectedAction = this.selectAction(possibleActions);

        const selectedKeys: KeyInput[] = [];

        console.log("SELECTED ACTION:", selectedAction);
        switch (selectedAction) {
          case "left":
            selectedKeys.push("a");
            break;
          case "right":
            selectedKeys.push("d");
            break;
          case "forward":
            selectedKeys.push("w");
            break;
          case "left-forward":
            selectedKeys.push("w");
            selectedKeys.push("a");
            break;
          case "right-forward":
            selectedKeys.push("w");
            selectedKeys.push("d");
            break;
          case "backwards":
            selectedKeys.push("s");
            break;
          case "nothing":
            break;
          default:
            throw new Error("Invalid action");
        }

        await this.page.keyboard.up("w");

        for (const key of selectedKeys) {
          await this.page.keyboard.down(key);
        }

        if (jump) {
          await this.page.keyboard.press("Space", { delay: 250 });
          await this.page.mouse.click(100, 100, {
            button: "right",
            delay: 650,
          });
        }

        await sleep(intervalMs);

        for (const key of selectedKeys) {
          await this.page.keyboard.up(key);
        }
      }
    );
  }

  private isRandomAction(action: string): action is RandomAction {
    // super unmaintainble. Refactor later
    const validActions: RandomAction[] = [
      "left",
      "right",
      "forward",
      "left-forward",
      "right-forward",
      "nothing",
    ];
    return validActions.includes(action as RandomAction);
  }

  private selectAction(probabilities: RandomActionProbabilities): RandomAction {
    const entries = Object.entries(probabilities);

    let totalProb = 0;
    const probArray: Array<[RandomAction, number]> = [];

    for (const [key, value] of entries) {
      if (typeof value == "number" && this.isRandomAction(key)) {
        totalProb += value;
        probArray.push([key, totalProb]);
      }
    }

    const random = Math.random() * totalProb;
    for (const [key, prob] of probArray) {
      if (random <= prob) {
        return key;
      }
    }
    return probArray[probArray.length - 1][0];
  }

  private async promptVisionGpt4(
    screenshotBase64: string
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    console.log("Prompting GPT-4 Vision");
    const response = await this.openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "You are a bot for Buddy Blitz, a simulation I'm developed. You are designed to output JSON, and only JSON",
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
    return response;
  }
}
