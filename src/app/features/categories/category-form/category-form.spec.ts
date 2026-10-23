import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../../environments/environment';
import { CategoryResponse } from '../categories.models';
import { CategoryForm } from './category-form';

const base = `${environment.apiUrl}/api/categories`;

const food: CategoryResponse = {
  id: 'food',
  name: 'Food',
  kind: 'Expense',
  color: 'orange',
  icon: 'food',
  isArchived: false,
  hasTransactions: true,
  createdAt: '2026-10-20T15:00:00Z',
  updatedAt: '2026-10-20T15:00:00Z',
};

describe('CategoryForm', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [CategoryForm],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function render(setup: (form: CategoryForm) => void = () => undefined) {
    const fixture = TestBed.createComponent(CategoryForm);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    // Los radios se buscan por su etiqueta (visible o para lectores de pantalla), como los encuentra el usuario.
    const radio = (label: string) =>
      [...element.querySelectorAll('label')].find((item) => item.textContent!.trim() === label)!.querySelector('input')!;
    const submit = () => {
      element.querySelector('form')!.dispatchEvent(new Event('submit'));
      fixture.detectChanges();
    };
    return { fixture, element, radio, submit };
  }

  it('offers every allow-listed color and icon as a labelled radio option', () => {
    const form = render();

    expect(form.element.querySelectorAll('.swatch input[type="radio"]')).toHaveLength(10);
    expect(form.element.querySelectorAll('.icon-option input[type="radio"]')).toHaveLength(16);
    expect(form.element.querySelector('.swatch')!.textContent).toContain('Slate');
  });

  it('creates a category with the chosen kind, color and icon', () => {
    const form = render((component) => (component.initialKind = 'Income'));

    const name = form.element.querySelector<HTMLInputElement>('#category-name')!;
    name.value = ' Bonus ';
    name.dispatchEvent(new Event('input'));
    form.radio('Green').click();
    form.radio('Investments').click();
    form.submit();

    const request = httpMock.expectOne(base);
    expect(request.request.body).toEqual({ name: 'Bonus', kind: 'Income', color: 'green', icon: 'investments' });
    request.flush({ ...food, id: 'bonus', name: 'Bonus', kind: 'Income', hasTransactions: false });
  });

  it('locks the kind of a used category and keeps its archived flag', () => {
    const form = render((component) => (component.category = food));

    expect(form.radio('Income').disabled).toBe(true);
    expect(form.element.textContent).toContain('The kind cannot change because the category has transactions.');
    form.radio('Red').click();
    form.submit();

    const request = httpMock.expectOne(`${base}/food`);
    expect(request.request.body).toEqual({ name: 'Food', kind: 'Expense', color: 'red', icon: 'food', isArchived: false });
    request.flush({ ...food, color: 'red' });
  });

  it('does not submit without a name', () => {
    const form = render();

    form.submit();

    expect(form.element.querySelector('#category-name-error')!.textContent).toContain('Name is required.');
    httpMock.expectNone(base);
  });
});
