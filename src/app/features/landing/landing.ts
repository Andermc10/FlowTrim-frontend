import { Component, DestroyRef, ElementRef, Injector, afterNextRender, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { landingSample } from './landing-sample';
import { LandingMotionHandle, LandingMotionService } from './landing-motion.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { localeFor, moneyFormatter } from '../../core/format/money';
import { MoneyPipe } from '../../core/format/money.pipe';
import { ThemeService } from '../../core/theme/theme.service';
import { BackToTop } from '../../core/ui/back-to-top/back-to-top';
import { CategoryIcon } from '../../core/ui/icon/category-icon';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Elemento de la cuadrícula de funciones: ícono de texto y claves de título y descripción. */
interface Feature {
  icon: string;
  key: string;
}

/**
 * Landing de FlowTrim 3.0 (EP-13 / HU-69): cuenta el ciclo diario (cuentas → registro rápido → cobros del mes →
 * "Puedes gastar hoy"), luego las suscripciones, la fórmula y los principios. Está completo sin animaciones: la capa
 * de movimiento (HU-70) solo se añade encima. Todas las cifras son datos de ejemplo etiquetados.
 */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslatePipe, MoneyPipe, BackToTop, CategoryIcon],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly i18n = inject(I18nService);
  private readonly theme = inject(ThemeService);
  private readonly motion = inject(LandingMotionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly sample = landingSample;
  protected readonly themeMode = this.theme.mode;

  protected readonly features: readonly Feature[] = [
    { icon: '☀', key: 'today' },
    { icon: '◧', key: 'accounts' },
    { icon: '≡', key: 'transactions' },
    { icon: 'N', key: 'quickAdd' },
    { icon: '◈', key: 'categories' },
    { icon: '◫', key: 'subscriptions' },
    { icon: '◔', key: 'analytics' },
    { icon: '⇅', key: 'csv' },
    { icon: '◎', key: 'assistant' },
  ];

  protected readonly principles: readonly string[] = ['manual', 'facts', 'deterministic', 'isolated'];

  private motionHandle: LandingMotionHandle | null = null;
  private destroyed = false;

  constructor() {
    // HU-70: la capa de movimiento se carga después del primer render y nunca con movimiento reducido (EP-13 D6).
    afterNextRender(() => this.startMotion());

    // Al cambiar de idioma cambian las longitudes de los textos: ScrollTrigger recalcula el pin tras el nuevo render.
    effect(() => {
      this.i18n.language();
      afterNextRender(() => this.motionHandle?.refresh(), { injector: this.injector });
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.motionHandle?.destroy();
      this.motionHandle = null;
    });
  }

  protected toggleLanguage(): void {
    this.i18n.toggleLanguage();
  }

  protected toggleTheme(): void {
    this.theme.toggle();
  }

  protected themeLabel(): string {
    return this.i18n.translate(this.themeMode() === 'dark' ? 'nav.switchToLight' : 'nav.switchToDark');
  }

  private startMotion(): void {
    if (prefersReducedMotion()) {
      return;
    }
    const format = (value: number) => moneyFormatter(this.sample.currency, localeFor(this.i18n.language()))(value);
    this.motion.start(this.host.nativeElement, format).then(
      (handle) => {
        // Si el usuario ya salió del landing mientras GSAP cargaba, se deshace de inmediato.
        if (this.destroyed) {
          handle.destroy();
        } else {
          this.motionHandle = handle;
        }
      },
      // Sin red o con el chunk bloqueado el landing sigue completo y estático (EP-13 §8).
      (error: unknown) => console.warn('Landing motion is unavailable; showing the static page.', error),
    );
  }
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
