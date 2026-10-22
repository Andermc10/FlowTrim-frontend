import { TestBed } from '@angular/core/testing';

import { AUDIO_CONTEXT_FACTORY, ChimeAudioContext, SoundService, soundPreferenceKey } from './sound.service';

/** Doble del contexto de audio: cuenta notas y frecuencias sin producir sonido. */
function fakeContext(state: AudioContextState = 'running') {
  const frequencies: number[] = [];
  const param = () => ({ setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });
  const context = {
    currentTime: 0,
    destination: {},
    state,
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: () => {
      const oscillator = {
        type: 'sine',
        frequency: { setValueAtTime: (value: number) => frequencies.push(value) },
        connect: (node: unknown) => node,
        start: () => undefined,
        stop: () => undefined,
      };
      return oscillator;
    },
    createGain: () => ({ gain: param(), connect: (node: unknown) => node }),
  };
  return { context: context as unknown as ChimeAudioContext, frequencies };
}

describe('SoundService (HU-62)', () => {
  let created: number;
  let fake: ReturnType<typeof fakeContext>;

  function setup(factory: () => ChimeAudioContext | null = () => fake.context) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AUDIO_CONTEXT_FACTORY,
          useValue: () => {
            created++;
            return factory();
          },
        },
      ],
    });
    return TestBed.inject(SoundService);
  }

  beforeEach(() => {
    localStorage.clear();
    created = 0;
    fake = fakeContext();
  });

  it('is off by default and never creates an audio context while off (AC-1)', () => {
    const sound = setup();

    sound.play('overdue');

    expect(sound.enabled()).toBe(false);
    expect(created).toBe(0);
  });

  it('plays a preview when turned on, remembers the choice and plays the matching chime (AC-2)', () => {
    const sound = setup();

    sound.setEnabled(true);
    expect(localStorage.getItem(soundPreferenceKey)).toBe('true');
    expect(fake.frequencies).toEqual([880, 1175]);

    sound.play('overdue');
    expect(fake.frequencies).toEqual([880, 1175, 440, 330]);
    expect(created).toBe(1);
  });

  it('resumes a suspended context and never throws when audio is unavailable', () => {
    fake = fakeContext('suspended');
    const sound = setup();
    sound.setEnabled(true);
    expect(fake.context.resume).toHaveBeenCalled();

    TestBed.resetTestingModule();
    localStorage.setItem(soundPreferenceKey, 'true');
    const broken = setup(() => {
      throw new Error('blocked');
    });
    expect(() => broken.play('soon')).not.toThrow();
  });
});
