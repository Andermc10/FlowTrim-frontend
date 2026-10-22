import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';

import { I18nService } from './i18n.service';
import { TranslatedTitleStrategy } from './translated-title-strategy';

@Component({ template: '' })
class Blank {}

describe('TranslatedTitleStrategy', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'assistant', component: Blank, title: 'nav.insights' },
        ]),
        { provide: TitleStrategy, useExisting: TranslatedTitleStrategy },
      ],
    });
  });

  it('shows the translated screen name with the product name and follows the language', async () => {
    const router = TestBed.inject(Router);
    const title = TestBed.inject(Title);

    await router.navigateByUrl('/assistant');
    expect(title.getTitle()).toBe('AI Assistant · FlowTrim');

    TestBed.inject(I18nService).toggleLanguage();
    TestBed.tick();
    expect(title.getTitle()).toBe('Asistente IA · FlowTrim');

    await router.navigateByUrl('/');
    expect(title.getTitle()).toBe('FlowTrim');
  });
});
