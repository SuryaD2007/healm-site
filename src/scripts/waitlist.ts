/**
 * <healm-waitlist>: posts {email, source: "web", website} to the web-waitlist endpoint and shows what
 * happened. Errors say what to do next, sit right under the field, and move focus to it. Success swaps
 * the form for a small ring that fills and checks, and moves focus to the confirmation.
 */
import type { HealmScanRing } from '@/scripts/scan-ring';

// The server's own check (the app's waitlist uses the same pattern).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIMEOUT_MS = 10000;

type Reply = { ok: true } | { ok: false; error?: string };

class HealmWaitlist extends HTMLElement {
  private sending = false;

  connectedCallback() {
    const form = this.querySelector<HTMLFormElement>('[data-form]');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = 'true';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });
    // Once someone has been told what to fix, the message clears as soon as the email looks right.
    this.input.addEventListener('input', () => {
      if (this.input.getAttribute('aria-invalid') === 'true' && EMAIL.test(this.input.value.trim())) this.clearError();
    });
  }

  private get input() {
    return this.querySelector<HTMLInputElement>('[data-email-input]')!;
  }

  private async submit() {
    if (this.sending) return;
    const email = this.input.value.trim();
    if (!EMAIL.test(email)) {
      this.showError(email ? 'That email looks incomplete. Check it, like name@example.com.' : 'Enter your email, like name@example.com.');
      return;
    }
    this.clearError();

    const contact = this.dataset.email ?? '';
    if (this.dataset.ready !== 'true') {
      this.showError(`The waitlist opens soon. Until then, email ${contact} and you’re on it.`, false);
      return;
    }

    const website = this.querySelector<HTMLInputElement>('[data-honeypot]')?.value ?? '';
    this.setSending(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(this.dataset.url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'web', website }),
        signal: controller.signal,
      });
      const reply = (await res.json().catch(() => null)) as Reply | null;
      if (reply && reply.ok) {
        this.showDone();
      } else {
        const said = reply && !reply.ok && typeof reply.error === 'string' && reply.error.trim();
        // The server's own words are about the email (already listed, not accepted); a bare failure is not.
        this.showError(said || 'That didn’t go through. Try again in a moment.', !!said);
      }
    } catch {
      this.showError('That didn’t go through. Check your connection and try again.', false);
    } finally {
      window.clearTimeout(timer);
      this.setSending(false);
    }
  }

  private setSending(on: boolean) {
    this.sending = on;
    const button = this.querySelector<HTMLButtonElement>('[data-submit]')!;
    const label = this.querySelector('[data-submit-label]')!;
    // The button stays enabled until the request starts, and says what is happening while it runs.
    button.setAttribute('aria-busy', String(on));
    label.textContent = on ? 'Joining…' : 'Join the waitlist';
  }

  /** `field` is false when the email is fine and something else went wrong (the network, the service). */
  private showError(text: string, field = true) {
    const box = this.querySelector<HTMLElement>('[data-error]')!;
    this.querySelector('[data-error-text]')!.textContent = text;
    box.hidden = false;
    if (field) this.input.setAttribute('aria-invalid', 'true');
    else this.input.removeAttribute('aria-invalid');
    this.input.focus();
  }

  private clearError() {
    this.querySelector<HTMLElement>('[data-error]')!.hidden = true;
    this.input.removeAttribute('aria-invalid');
  }

  private showDone() {
    this.querySelector<HTMLElement>('[data-form]')!.hidden = true;
    const done = this.querySelector<HTMLElement>('[data-done]')!;
    done.hidden = false;
    this.querySelector<HTMLElement>('[data-done-title]')?.focus();
    // The ring needs a frame to lay out before it fills.
    requestAnimationFrame(() => done.querySelector<HealmScanRing>('healm-scan-ring')?.play());
  }
}

if (!customElements.get('healm-waitlist')) customElements.define('healm-waitlist', HealmWaitlist);
