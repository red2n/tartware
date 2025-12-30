import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BreakGlassComponent } from './break-glass.component';
import { AdminAuthService, BreakGlassResponse } from '../services/admin-auth.service';
import { API_BASE } from '../services/api-config';

describe('BreakGlassComponent', () => {
  let authSpy: jasmine.SpyObj<AdminAuthService>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AdminAuthService', ['breakGlass']);

    await TestBed.configureTestingModule({
      imports: [BreakGlassComponent],
      providers: [
        { provide: AdminAuthService, useValue: authSpy },
        { provide: API_BASE, useValue: '/api' },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(BreakGlassComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('submits when form is valid and shows success', fakeAsync(() => {
    const fixture = TestBed.createComponent(BreakGlassComponent);
    const component = fixture.componentInstance;
    const fingerprint = component.form.controls.device_fingerprint.value;

    component.form.setValue({
      username: 'alice',
      break_glass_code: 'code-1234',
      reason: 'emergency access for audit',
      ticket_id: 'INC-1',
      device_fingerprint: fingerprint,
    });

    const response: BreakGlassResponse = {
      access_token: 'token',
      token_type: 'Bearer',
      expires_in: 60,
      scope: 'SYSTEM_ADMIN',
      session_id: 'session-1',
      admin: {},
    };

    authSpy.breakGlass.and.returnValue(of(response));

    component.onSubmit();
    flushMicrotasks();

    expect(authSpy.breakGlass).toHaveBeenCalledWith(component.form.getRawValue());
    expect(component.statusMessage()).toContain('Break-glass accepted');
    expect(component.errorMessage()).toBe('');
  }));

  it('surfaces API errors', fakeAsync(() => {
    const fixture = TestBed.createComponent(BreakGlassComponent);
    const component = fixture.componentInstance;
    const fingerprint = component.form.controls.device_fingerprint.value;

    component.form.setValue({
      username: 'alice',
      break_glass_code: 'code-1234',
      reason: 'emergency access for audit',
      ticket_id: 'INC-1',
      device_fingerprint: fingerprint,
    });

    authSpy.breakGlass.and.returnValue(throwError(() => new Error('boom')));

    component.onSubmit();
    flushMicrotasks();

    expect(component.errorMessage()).toContain('boom');
    expect(component.loading()).toBeFalse();
  }));
});
