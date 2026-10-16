import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `
    <main class="not-found">
      <p class="not-found__code">404 / OUT OF RANGE</p>
      <h1>This route got trimmed.</h1>
      <p>The page you requested does not exist in this workspace.</p>
      <a routerLink="/">Return home</a>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: var(--color-background); color: var(--color-text); }
    .not-found { display: grid; place-content: center; min-height: 100vh; max-width: 34rem; margin: auto; padding: 2rem; text-align: center; }
    .not-found__code { color: var(--color-primary); font-size: .7rem; font-weight: 800; letter-spacing: .15em; }
    h1 { margin: 1rem 0; font-size: clamp(2.4rem, 7vw, 4.8rem); letter-spacing: -.08em; line-height: .9; }
    p:not(.not-found__code) { color: var(--color-muted); line-height: 1.7; }
    a { display: inline-block; margin: 1rem auto 0; padding: .8rem 1rem; border-radius: .6rem; background: var(--color-primary); color: #061014; font-weight: 800; text-decoration: none; }
  `,
})
export class NotFound {}
