export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function nonBlockingWhile(
  condition: () => boolean,
  task: () => Promise<void>
) {
  while (condition()) {
    await task();
    await new Promise((resolve) => setTimeout(resolve, 0)); // Yield control
  }
}
