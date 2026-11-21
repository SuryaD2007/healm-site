/**
 * Sound, off by default and never played until the visitor turns it on. Two of the app's own sounds
 * (Healm/Resources/Sounds): scan.tick for each tick of the ring, at most one every 30 ms like the app's
 * tick haptic (SkinHaptics.swift, SkinTickGate), and scan.complete when a ring finishes.
 * Nothing is remembered between visits, so a page never opens with sound.
 */
import { url } from '@/lib/url';

type Name = 'scan-tick' | 'scan-complete';

class HealmSound extends EventTarget {
  enabled = false;
  private ctx?: AudioContext;
  private buffers = new Map<Name, AudioBuffer>();
  private lastTick = 0;

  /** Turns sound on. Must run inside a tap or click: browsers allow audio only after one. */
  async enable() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    this.ctx ??= new Ctx();
    await this.ctx.resume();
    await Promise.all((['scan-tick', 'scan-complete'] as Name[]).map((n) => this.load(n)));
    this.enabled = true;
    this.dispatchEvent(new Event('change'));
    return true;
  }

  disable() {
    this.enabled = false;
    this.dispatchEvent(new Event('change'));
  }

  tick() {
    const now = performance.now();
    if (now - this.lastTick < 30) return;
    this.lastTick = now;
    this.play('scan-tick', 0.55);
  }

  complete() {
    this.play('scan-complete', 0.8);
  }

  private async load(name: Name) {
    if (this.buffers.has(name) || !this.ctx) return;
    const res = await fetch(url(`sounds/${name}.wav`));
    const data = await res.arrayBuffer();
    this.buffers.set(name, await this.ctx.decodeAudioData(data));
  }

  private play(name: Name, volume: number) {
    if (!this.enabled || !this.ctx) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain).connect(this.ctx.destination);
    source.start();
  }
}

export const sound = new HealmSound();

/** Wires every [data-sound-toggle] button on the page. */
export function bindSoundToggles() {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-sound-toggle]')];
  const sync = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String(sound.enabled)));
  sound.addEventListener('change', sync);
  buttons.forEach((b) =>
    b.addEventListener('click', async () => {
      if (sound.enabled) sound.disable();
      else await sound.enable();
    }),
  );
  sync();
}
