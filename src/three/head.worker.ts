/// <reference lib="webworker" />
// Builds the head's points off the main thread, so the page never stalls while they are made.
import { generateHead } from './head';

self.onmessage = (event: MessageEvent<{ count: number }>) => {
  const head = generateHead(event.data.count);
  const transfer = [head.positions.buffer, head.normals.buffer, head.seeds.buffer, head.regions.buffer, head.lines.buffer];
  (self as unknown as Worker).postMessage(head, [...new Set(transfer)] as Transferable[]);
};
