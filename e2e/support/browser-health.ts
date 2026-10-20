import { Page } from '@playwright/test';

/**
 * Registra errores de consola, errores de página y peticiones fallidas (red o HTTP >= 400). Las respuestas que el
 * flujo provoca a propósito se declaran con `expect`, junto con los mensajes de consola que generan.
 */
export class BrowserHealth {
  private readonly problems: string[] = [];
  private readonly expected: RegExp[] = [];

  constructor(page: Page) {
    page.on('console', (message) => {
      if (message.type() === 'error') {
        this.report(`console: ${message.text()} @ ${message.location().url}`);
      }
    });
    page.on('pageerror', (error) => this.report(`page error: ${error.message}`));
    page.on('requestfailed', (request) => this.report(`request failed: ${request.method()} ${request.url()}`));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        this.report(`HTTP ${response.status()}: ${response.request().method()} ${response.url()}`);
      }
    });
  }

  /** Declara una respuesta esperada: se aceptan los problemas cuyo texto contiene esa URL. */
  expect(url: string): void {
    this.expected.push(new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  unexpected(): string[] {
    return this.problems.filter((problem) => !this.expected.some((pattern) => pattern.test(problem)));
  }

  private report(problem: string): void {
    this.problems.push(problem);
  }
}
