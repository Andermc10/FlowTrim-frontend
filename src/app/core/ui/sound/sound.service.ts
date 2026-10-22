import { Injectable, InjectionToken, inject, signal } from '@angular/core';

/** Tipo de aviso sonoro: algo vence pronto o ya está vencido. */
export type AlertChime = 'soon' | 'overdue';

/** Lo mínimo del contexto de audio que usa el servicio (permite un doble en pruebas). */
export type ChimeAudioContext = Pick<AudioContext, 'currentTime' | 'destination' | 'state' | 'resume' | 'createOscillator' | 'createGain'>;

/** Crea el contexto de audio del navegador, o null si no existe (navegadores antiguos, pruebas). */
export const AUDIO_CONTEXT_FACTORY = new InjectionToken<() => ChimeAudioContext | null>('AUDIO_CONTEXT_FACTORY', {
  providedIn: 'root',
  factory: () => () => (typeof AudioContext === 'undefined' ? null : new AudioContext()),
});

export const soundPreferenceKey = 'flowtrim-sound';

// Notas (Hz) y duración de cada una: dos tonos suaves ascendentes para "pronto", dos graves para "vencido".
const chimes: Record<AlertChime, readonly number[]> = {
  soon: [880, 1175],
  overdue: [440, 330],
};
const noteSeconds = 0.16;
const volume = 0.06;

/**
 * Sonido opcional de las alertas de cobro (HU-62). Apagado por defecto y guardado por navegador. El audio se genera con
 * la Web Audio API (sin archivos); el contexto solo se crea cuando el usuario lo activó, y un navegador que bloquea el
 * audio nunca rompe la alerta visual.
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly createContext = inject(AUDIO_CONTEXT_FACTORY);
  private context: ChimeAudioContext | null = null;

  readonly enabled = signal(this.readPreference());

  /** Activa o desactiva el sonido; al activarlo suena una muestra (ese clic también desbloquea el audio). */
  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    try {
      localStorage.setItem(soundPreferenceKey, String(enabled));
    } catch {
      // Sin almacenamiento la preferencia dura solo esta sesión.
    }
    if (enabled) {
      this.play('soon');
    }
  }

  /** Reproduce el aviso si el usuario lo activó; si el navegador lo impide, no pasa nada. */
  play(chime: AlertChime): void {
    if (!this.enabled()) {
      return;
    }
    try {
      const context = (this.context ??= this.createContext());
      if (!context) {
        return;
      }
      if (context.state === 'suspended') {
        void context.resume().catch(() => undefined);
      }
      chimes[chime].forEach((frequency, index) => this.note(context, frequency, context.currentTime + index * noteSeconds));
    } catch {
      // El audio es un extra: cualquier fallo del navegador se ignora.
    }
  }

  // Una nota con envolvente corta (sube y baja el volumen) para que no haga "clic".
  private note(context: ChimeAudioContext, frequency: number, start: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + noteSeconds);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + noteSeconds);
  }

  private readPreference(): boolean {
    try {
      return localStorage.getItem(soundPreferenceKey) === 'true';
    } catch {
      return false;
    }
  }
}
