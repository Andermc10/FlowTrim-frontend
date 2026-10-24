import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { I18nService } from '../../core/i18n/i18n.service';
import { Landing } from './landing';
import { LandingMotionHandle, LandingMotionService } from './landing-motion.service';

// matchMedia falso: decide si hay movimiento reducido y si la ventana es ancha (pin) o estrecha.
function stubMatchMedia(options: { reducedMotion?: boolean; width?: number } = {}): void {
  const width = options.width ?? 1280;
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = query.includes('prefers-reduced-motion')
      ? options.reducedMotion ?? false
      : (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
    return {
      matches, media: query, onchange: null,
      addListener: () => undefined, removeListener: () => undefined,
      addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false,
    } as MediaQueryList;
  }) as typeof window.matchMedia;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** HU-70: cuándo se carga la capa de movimiento y cómo se limpia (con un servicio falso). */
describe('Landing motion wiring', () => {
  let start: ReturnType<typeof vi.fn>;
  let handle: { refresh: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    localStorage.clear();
    handle = { refresh: vi.fn(), destroy: vi.fn() };
    start = vi.fn(() => Promise.resolve(handle as LandingMotionHandle));
    TestBed.configureTestingModule({
      imports: [Landing],
      providers: [provideRouter([]), { provide: LandingMotionService, useValue: { start } }],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    await fixture.whenStable();
    await flush();
    return fixture;
  }

  it('never loads the motion layer with reduced motion', async () => {
    stubMatchMedia({ reducedMotion: true });

    await render();

    expect(start).not.toHaveBeenCalled();
  });

  it('starts once after the first render and undoes everything on destroy', async () => {
    stubMatchMedia();

    const fixture = await render();
    expect(start).toHaveBeenCalledTimes(1);
    expect(start.mock.calls[0][0]).toBe(fixture.nativeElement);
    fixture.destroy();

    expect(handle.destroy).toHaveBeenCalledTimes(1);
  });

  it('refreshes the scroll triggers after a language switch', async () => {
    stubMatchMedia();
    const fixture = await render();
    handle.refresh.mockClear();

    TestBed.inject(I18nService).toggleLanguage();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(handle.refresh).toHaveBeenCalled();
  });

  it('destroys a layer that finishes loading after the visitor left', async () => {
    stubMatchMedia();
    let resolve!: (value: LandingMotionHandle) => void;
    start.mockImplementation(() => new Promise((done) => (resolve = done)));
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.destroy();
    resolve(handle as LandingMotionHandle);
    await flush();

    expect(handle.destroy).toHaveBeenCalledTimes(1);
  });

  it('keeps the static page when the motion chunk cannot load', async () => {
    stubMatchMedia();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    start.mockImplementation(() => Promise.reject(new Error('chunk blocked')));

    const fixture = await render();

    expect(warn).toHaveBeenCalledWith('Landing motion is unavailable; showing the static page.', expect.any(Error));
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.story-step')).toHaveLength(4);
    warn.mockRestore();
  });
});

/**
 * HU-70 con GSAP real: pin solo en pantallas anchas y ningún trigger sobrante al entrar y salir varias veces. Cargan
 * GSAP y renderizan el landing completo, más lento que el resto en una máquina con poca memoria: tiempo límite mayor.
 */
describe('LandingMotionService with GSAP', { timeout: 20_000 }, () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [Landing],
      // El landing no arranca la capa por sí solo: la prueba la arranca con el servicio real para medirla.
      providers: [provideRouter([]), { provide: LandingMotionService, useValue: { start: () => new Promise(() => undefined) } }],
    });
  });

  async function startOn(width: number) {
    stubMatchMedia({ width });
    const fixture = TestBed.createComponent(Landing);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const handle = await new LandingMotionService().start(root, (value) => `COP ${value}`);
    return { fixture, root, handle };
  }

  it('pins the daily story on wide screens and removes it on destroy', async () => {
    const view = await startOn(1280);

    expect(view.root.querySelector('.story')!.classList.contains('story--pinned')).toBe(true);
    expect(ScrollTrigger.getAll().some((trigger) => trigger.pin)).toBe(true);
    view.handle.destroy();

    expect(view.root.querySelector('.story')!.classList.contains('story--pinned')).toBe(false);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    view.fixture.destroy();
  });

  it('restores the final counter text when the layer is undone mid-count', async () => {
    const view = await startOn(1280);
    const counter = view.root.querySelector('[data-motion="counter"]')!;

    view.handle.destroy();

    expect(counter.textContent).toBe('COP 113610');
    view.fixture.destroy();
  });

  it('does not pin below 760 px', async () => {
    const view = await startOn(360);

    expect(view.root.querySelector('.story')!.classList.contains('story--pinned')).toBe(false);
    expect(ScrollTrigger.getAll().some((trigger) => trigger.pin)).toBe(false);
    view.handle.destroy();
    view.fixture.destroy();
  });

  it('leaves exactly one set of triggers after entering and leaving three times', async () => {
    const counts: number[] = [];
    for (let visit = 0; visit < 3; visit++) {
      const view = await startOn(1280);
      counts.push(ScrollTrigger.getAll().length);
      view.handle.destroy();
      view.fixture.destroy();
    }

    expect(counts[0]).toBeGreaterThan(0);
    expect(new Set(counts).size).toBe(1);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
