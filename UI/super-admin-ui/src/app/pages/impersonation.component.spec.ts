import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ImpersonationComponent } from './impersonation.component';
import { AdminAuthService, ImpersonationResponse } from '../services/admin-auth.service';
import { API_BASE } from '../services/api-config';

describe('ImpersonationComponent', () => {
  let authSpy: jasmine.SpyObj<AdminAuthService>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AdminAuthService', ['startImpersonation']);

    await TestBed.configureTestingModule({
      imports: [ImpersonationComponent],
      providers: [
        { provide: AdminAuthService, useValue: authSpy },
        { provide: API_BASE, useValue: '/api' },
      ],
    }).compileComponents();
  });

  it('shows the confirmation dialog when form is valid', () => {
    const fixture = TestBed.createComponent(ImpersonationComponent);
    const component = fixture.componentInstance;

    component.form.setValue({
      tenant_id: 'tenant-1234',
      user_id: 'user-1234',
      reason: 'support request',
      ticket_id: 'INC-22',
    });

    component.onSubmit();

    expect(component.confirming()).toBeTrue();
  });

  it('starts impersonation when confirmed and shows token details', fakeAsync(() => {
    const fixture = TestBed.createComponent(ImpersonationComponent);
    const component = fixture.componentInstance;

    component.form.setValue({
      tenant_id: 'tenant-1234',
      user_id: 'user-1234',
      reason: 'support request',
      ticket_id: 'INC-22',
    });
    component.onSubmit();

    const response: ImpersonationResponse = {
      access_token: 'imp-token',
      token_type: 'Bearer',
      scope: 'TENANT_IMPERSONATION',
      expires_in: 90,
    };

    authSpy.startImpersonation.and.returnValue(of(response));

    component.confirmStart();
    flushMicrotasks();

    expect(authSpy.startImpersonation).toHaveBeenCalledWith(component.form.getRawValue());
    expect(component.sessionToken()).toBe('imp-token');
    expect(component.statusMessage()).toContain('Impersonation started');
    expect(component.confirming()).toBeFalse();
  }));

  it('closes the dialog on Escape', () => {
    const fixture = TestBed.createComponent(ImpersonationComponent);
    const component = fixture.componentInstance;

    component.confirming.set(true);
    const event = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(event);

    expect(component.confirming()).toBeFalse();
  });

  it('surfaces errors from the API', fakeAsync(() => {
    const fixture = TestBed.createComponent(ImpersonationComponent);
    const component = fixture.componentInstance;

    component.form.setValue({
      tenant_id: 'tenant-1234',
      user_id: 'user-1234',
      reason: 'support request',
      ticket_id: 'INC-22',
    });
    component.onSubmit();

    authSpy.startImpersonation.and.returnValue(throwError(() => new Error('nope')));

    component.confirmStart();
    flushMicrotasks();

    expect(component.errorMessage()).toContain('nope');
    expect(component.confirming()).toBeFalse();
  }));
});
