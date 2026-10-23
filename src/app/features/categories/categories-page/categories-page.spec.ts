import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../core/ui/toast/toast.service';
import { CategoryResponse } from '../categories.models';
import { CategoriesPage } from './categories-page';

const base = `${environment.apiUrl}/api/categories`;

function category(overrides: Partial<CategoryResponse>): CategoryResponse {
  return {
    id: 'food',
    name: 'Food',
    kind: 'Expense',
    color: 'orange',
    icon: 'food',
    isArchived: false,
    hasTransactions: false,
    createdAt: '2026-10-20T15:00:00Z',
    updatedAt: '2026-10-20T15:00:00Z',
    ...overrides,
  };
}

/** HU-65: categorías por clase, archivado y borrado protegido. */
describe('CategoriesPage', () => {
  let httpMock: HttpTestingController;

  beforeAll(() => {
    // El entorno de pruebas no implementa <dialog>.showModal().
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [CategoriesPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(categories: CategoryResponse[]) {
    const fixture = TestBed.createComponent(CategoriesPage);
    fixture.detectChanges();
    httpMock.expectOne(`${base}?includeArchived=true`).flush(categories);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const click = (selector: string, root: ParentNode = element) => {
      root.querySelector<HTMLButtonElement>(selector)!.click();
      fixture.detectChanges();
    };
    return { fixture, element, click };
  }

  it('groups active categories by kind and lists archived ones apart', () => {
    const page = render([
      category({}),
      category({ id: 'gifts', name: 'Gifts', color: 'pink', icon: 'gifts', isArchived: true }),
      category({ id: 'salary', name: 'Salary', kind: 'Income', color: 'green', icon: 'salary' }),
    ]);

    const groups = [...page.element.querySelectorAll('.group')];
    expect(groups.map((group) => group.querySelector('h2')!.textContent)).toEqual(['Expenses', 'Income']);
    expect(groups[0].querySelectorAll('li.chip')).toHaveLength(1);
    expect(groups[1].textContent).toContain('Salary');
    expect(page.element.querySelector('details.archived summary')!.textContent).toContain('Archived categories (1)');
  });

  it('offers archiving instead of deleting a used category', () => {
    const toast = TestBed.inject(ToastService);
    const page = render([category({ hasTransactions: true })]);

    page.click('.icon-button--danger');
    expect(page.element.textContent).toContain('This category cannot be deleted');
    page.click('.primary-button');

    const update = httpMock.expectOne(`${base}/food`);
    expect(update.request.body).toEqual({ name: 'Food', kind: 'Expense', color: 'orange', icon: 'food', isArchived: true });
    update.flush(category({ isArchived: true, hasTransactions: true }));
    expect(toast.toasts()[0].message).toBe('"Food" was archived. Old transactions keep it.');
    httpMock.expectOne(`${base}?includeArchived=true`).flush([]);
  });

  it('opens the create form with the kind of the group', () => {
    const page = render([category({})]);

    page.click('button.btn', page.element.querySelectorAll('.group')[1]);

    const income = [...page.element.querySelectorAll('.kind-option')]
      .find((label) => label.textContent!.trim() === 'Income')!
      .querySelector('input')!;
    expect(income.checked).toBe(true);
  });

  it('explains a 409 when a transaction started using the category meanwhile', () => {
    const toast = TestBed.inject(ToastService);
    const page = render([category({})]);

    page.click('.icon-button--danger');
    page.click('.danger-button');
    httpMock.expectOne(`${base}/food`).flush({ code: 'category_in_use' }, { status: 409, statusText: 'Conflict' });

    expect(toast.toasts()[0].variant).toBe('warning');
    expect(toast.toasts()[0].message).toContain('Archive it instead.');
    httpMock.expectOne(`${base}?includeArchived=true`).flush([category({ hasTransactions: true })]);
  });
});
