import { Injectable } from '@angular/core';

/** Control de la capa de movimiento activa: recalcular tras cambios de texto y deshacer todo al salir. */
export interface LandingMotionHandle {
  refresh(): void;
  destroy(): void;
}

/** Ancho a partir del cual la historia del día se fija y avanza con el scroll (EP-13 D6). */
export const pinMinWidth = 760;

/**
 * Capa de movimiento del landing (HU-70). GSAP y ScrollTrigger se cargan aquí con `import()` dinámico, así que quedan en
 * un chunk aparte que solo descarga el landing y nunca entra en el bundle inicial (EP-13 D4). El landing decide si
 * llamar a `start` (no lo hace con movimiento reducido, D6).
 */
@Injectable({ providedIn: 'root' })
export class LandingMotionService {
  async start(root: HTMLElement, formatCounter: (value: number) => string): Promise<LandingMotionHandle> {
    const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
    gsap.registerPlugin(ScrollTrigger);

    // La portada se anima una sola vez por visita, en su propio contexto: cruzar los 760 px no la repite.
    const hero = gsap.context(() => animateHero(gsap, root, formatCounter), root);

    // El resto vive en un gsap.matchMedia: al revertirlo se deshacen tweens, triggers y espaciadores del pin, y al
    // cruzar el ancho de 760 px cambia solo entre la versión fija y la apilada.
    const media = gsap.matchMedia(root);
    const story = root.querySelector<HTMLElement>('[data-motion="story"]');

    media.add(
      {
        wide: `(min-width: ${pinMinWidth}px)`,
        narrow: `(max-width: ${pinMinWidth - 1}px)`,
      },
      (context) => {
        const { wide } = context.conditions as { wide: boolean; narrow: boolean };
        if (story) {
          if (wide) {
            pinStory(gsap, story);
          } else {
            revealSteps(gsap, story);
          }
        }
        revealSections(gsap, root);
        // Al revertir (salir o cambiar de ancho) se quita la clase que apila los pasos.
        return () => story?.classList.remove('story--pinned');
      },
    );

    return {
      refresh: () => ScrollTrigger.refresh(),
      destroy: () => {
        media.revert();
        hero.revert();
      },
    };
  }
}

type Gsap = typeof import('gsap').gsap;

// Portada: título, texto y maqueta entran una vez; la cifra cuenta hasta su valor y termina en el texto exacto.
// Devuelve la limpieza del contexto: si se revierte a mitad de la cuenta, la cifra vuelve a su texto final.
function animateHero(gsap: Gsap, root: HTMLElement, formatCounter: (value: number) => string): (() => void) | void {
  const hero = root.querySelector<HTMLElement>('[data-motion="hero"]');
  if (!hero) {
    return;
  }
  gsap.from(hero.querySelectorAll('.hero__copy > *'), { autoAlpha: 0, y: 24, duration: 0.7, stagger: 0.08, ease: 'power3.out' });
  gsap.from(hero.querySelector('.hero__visual'), { autoAlpha: 0, y: 40, scale: 0.97, duration: 0.9, delay: 0.15, ease: 'power3.out' });

  // Se anima el nodo de texto que ya pintó Angular (no se reemplaza), para no romper su enlace con el idioma.
  const counter = hero.querySelector<HTMLElement>('[data-motion="counter"]');
  const text = counter?.firstChild;
  const target = Number(counter?.dataset['value']);
  if (text && Number.isFinite(target)) {
    // El texto final se calcula con el mismo formato que el pipe (nunca se lee del DOM, que puede estar a medias).
    const restore = () => {
      text.textContent = formatCounter(target);
    };
    const state = { value: 0 };
    gsap.to(state, {
      value: target,
      duration: 1.4,
      delay: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        text.textContent = formatCounter(Math.round(state.value));
      },
      onComplete: restore,
    });
    return restore;
  }
}

// Escritorio: la lista de pasos se fija y el scroll recorre los 4 pasos (texto y maqueta a la vez). Los pasos inactivos
// quedan con visibility: hidden (autoAlpha), así el foco del teclado nunca cae en uno que no se ve.
function pinStory(gsap: Gsap, story: HTMLElement): void {
  // Se fija el escenario (barra de progreso + pasos) para que la barra se vea mientras dura el recorrido.
  const stage = story.querySelector<HTMLElement>('.story__stage');
  const steps = gsap.utils.toArray<HTMLElement>(story.querySelectorAll('[data-motion="step"]'));
  const progress = story.querySelector<HTMLElement>('.story__progress-bar');
  if (!stage || steps.length < 2) {
    return;
  }
  story.classList.add('story--pinned');
  gsap.set(steps.slice(1), { autoAlpha: 0, y: 48 });

  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: stage,
      start: 'top 15%',
      end: `+=${(steps.length - 1) * 90}%`,
      pin: true,
      scrub: 0.6,
      onUpdate: (self) => progress && gsap.set(progress, { scaleX: self.progress }),
    },
  });
  // Cada paso se queda un momento, sale por completo y luego entra el siguiente: nunca hay dos pasos legibles a la vez.
  steps.slice(1).forEach((step, index) => {
    timeline
      .to({}, { duration: 0.5 })
      .to(steps[index], { autoAlpha: 0, y: -40, duration: 0.6 })
      .to(step, { autoAlpha: 1, y: 0, duration: 0.6 });
  });
  timeline.to({}, { duration: 0.5 });
}

// Móvil: sin pin; cada paso aparece al entrar en pantalla.
function revealSteps(gsap: Gsap, story: HTMLElement): void {
  for (const step of gsap.utils.toArray<HTMLElement>(story.querySelectorAll('[data-motion="step"]'))) {
    gsap.from(step, { autoAlpha: 0, y: 32, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: step, start: 'top 85%', once: true } });
  }
}

// Secciones de abajo: entrada escalonada de su encabezado y sus tarjetas (solo opacity/transform).
function revealSections(gsap: Gsap, root: HTMLElement): void {
  for (const section of gsap.utils.toArray<HTMLElement>(root.querySelectorAll('[data-motion="reveal"]'))) {
    const items = section.querySelectorAll('.section-head > *, .subs-card, .formula-card, .feature, .principles__list > li, .final-cta > *');
    gsap.from(items, {
      autoAlpha: 0,
      y: 28,
      duration: 0.6,
      stagger: 0.06,
      ease: 'power2.out',
      scrollTrigger: { trigger: section, start: 'top 80%', once: true },
    });
  }
}
