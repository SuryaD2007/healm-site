/**
 * Chapter 2, Ask: the question types itself, goes up as a bubble, "Reading your file" shows, the answer
 * streams in as plain text in small chunks (the app shows each delta as it arrives, no per-letter motion),
 * then More, the receipts and the follow-ups fade in together on the app's fade (200 ms). It plays once,
 * when the phone is mostly on screen, and is over in about 4.2 seconds: under the 5 seconds after which
 * motion that starts by itself needs a pause (WCAG 2.2.2). Play it again replays it. Under Reduce Motion
 * the finished conversation shows and nothing plays.
 */
import { prefersReducedMotion } from '@/lib/motion';

const QUESTION = 'Why do I feel so good today?';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function setup() {
  const chapter = document.querySelector<HTMLElement>('[data-ask-chapter]');
  const screen = chapter?.querySelector<HTMLElement>('[data-ask-screen]');
  if (!chapter || !screen) return;
  const answer = screen.querySelector<HTMLElement>('[data-ask-answer]')!;
  const typed = screen.querySelector<HTMLElement>('[data-ask-typed]')!;
  const send = screen.querySelector<HTMLElement>('[data-ask-send]')!;
  const replay = chapter.querySelector<HTMLButtonElement>('[data-ask-replay]')!;
  const text = answer.dataset.text ?? answer.textContent ?? '';

  if (prefersReducedMotion()) return; // the finished conversation is already in the markup

  // The answer in the chunks a model streams: one to three words at a time, on a steady beat.
  const words = text.split(' ');
  const chunks: string[] = [];
  for (let i = 0, n = 0; i < words.length; i += n) {
    n = [2, 1, 3, 2, 2, 1, 3][chunks.length % 7];
    chunks.push(words.slice(i, i + n).join(' ') + (i + n < words.length ? ' ' : ''));
  }

  let run = 0;
  const play = async () => {
    const id = ++run;
    const alive = () => id === run;
    screen.classList.remove('is-sent', 'is-done', 'is-waiting', 'is-typing');
    screen.classList.add('is-playing');
    answer.textContent = '';
    typed.textContent = '';
    send.classList.remove('is-ready');
    replay.hidden = true;

    await sleep(300);
    if (!alive()) return;
    screen.classList.add('is-typing');
    for (let i = 0; i < QUESTION.length; i++) {
      typed.textContent += QUESTION[i];
      send.classList.add('is-ready');
      const ch = QUESTION[i];
      await sleep(ch === ' ' ? 60 : /[?,.]/.test(ch) ? 110 : 34 + ((i * 37) % 24));
      if (!alive()) return;
    }
    await sleep(280);
    if (!alive()) return;

    // Sent: the field empties and the question goes up.
    screen.classList.remove('is-typing');
    typed.textContent = '';
    send.classList.remove('is-ready');
    screen.classList.add('is-sent');
    await sleep(320);
    if (!alive()) return;

    // Before the first word: one quiet line, no spinner (AskWaitingLine).
    screen.classList.add('is-waiting');
    await sleep(800);
    if (!alive()) return;
    screen.classList.remove('is-waiting');

    for (const chunk of chunks) {
      answer.textContent += chunk;
      await sleep(70);
      if (!alive()) return;
    }
    await sleep(200);
    if (!alive()) return;
    screen.classList.add('is-done');
    screen.classList.remove('is-playing');
    replay.hidden = false;
  };

  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (!started && entries.some((e) => e.intersectionRatio >= 0.55)) {
      started = true;
      io.disconnect();
      play();
    }
  }, { threshold: [0, 0.55, 1] });
  io.observe(screen);
  // Hidden until it plays, so the finished screen never flashes first.
  screen.classList.add('is-playing');
  answer.textContent = '';

  replay.addEventListener('click', () => play());
}

setup();
