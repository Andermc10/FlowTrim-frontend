import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { I18nService } from '../../core/i18n/i18n.service';
import { BackToTop } from '../../core/ui/back-to-top/back-to-top';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, TranslatePipe, BackToTop],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly i18n = inject(I18nService);

  protected toggleLanguage(): void {
    this.i18n.toggleLanguage();
  }
}
