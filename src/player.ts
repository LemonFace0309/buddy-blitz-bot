import fs from "fs";
import path from "path";

import { KeyInput, Page } from "puppeteer";
import OpenAI from "openai";
import "dotenv/config";

import { nonBlockingWhile, sleep } from "./utils";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const WAIT_ROOM_ACTION_INTERVAL = 600;
const SLIDE_DELAY_AFTER_JUMP = 250;

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
  | "nothing";
type ControlledAction = "jump";

type RandomActionProbabilities = Record<RandomAction, number>;
type ControlledActionProbabilities = Record<ControlledAction, number>;

type ActionProbabilities = RandomActionProbabilities &
  ControlledActionProbabilities;

export class Player {
  page: Page;
  openai: OpenAI;
  isZooming: boolean = false;

  constructor(page: Page) {
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not defined");
    }

    this.page = page;
    this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  public async queueGame() {
    // Join a game queue

    console.log("JOINING GAME");
    await this.page.keyboard.press("j");

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

  public async initNaeNae(intervalMs: number) {
    this.isZooming = true;
    this.naenae(intervalMs);
  }

  public async chillOut() {
    this.isZooming = false;
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

  async naenae(intervalMs: number) {
    await nonBlockingWhile(
      () => this.isZooming,
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
          await this.page.keyboard.press("Space");
          await sleep(SLIDE_DELAY_AFTER_JUMP);
          await this.page.mouse.click(100, 100, { button: "right" });
          await sleep(500);
        };
        await Promise.all([getResponse(), jumpAndSlide()]);

        await this.page.keyboard.up("w");

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
          case "nothing":
            break;
          default:
            throw new Error("Invalid action");
        }

        for (const key of selectedKeys) {
          await this.page.keyboard.down(key);
        }

        let RightClickDelayMs = 0;
        if (jump) {
          RightClickDelayMs = SLIDE_DELAY_AFTER_JUMP;
          await this.page.keyboard.press("Space");
          await sleep(RightClickDelayMs);
          await this.page.mouse.click(100, 100, { button: "right" });
        }

        await sleep(intervalMs - RightClickDelayMs);

        for (const key of selectedKeys) {
          await this.page.keyboard.up(key);
        }
      }
    );
  }

  selectAction(probabilities: RandomActionProbabilities): RandomAction {
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

  async promptVisionGpt4(
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

  isRandomAction(action: string): action is RandomAction {
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
