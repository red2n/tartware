import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { AuthContext } from '../models/user.model';
import { AuthService } from './auth.service';
import { ErrorHandlerService } from './error-handler.service';

describe('AuthService role helpers', () => {
  let service: AuthService;
  const httpMock = {
    post: jasmine.createSpy('post'),
  };
  const routerMock = {
    navigate: jasmine.createSpy('navigate'),
    createUrlTree: jasmine.createSpy('createUrlTree'),
  };
  const errorHandlerMock = {
    handleHttpError: jasmine.createSpy('handleHttpError'),
  };

  beforeEach(() => {
    spyOn(localStorage, 'getItem').and.returnValue(null);
    spyOn(localStorage, 'setItem');
    spyOn(localStorage, 'removeItem');

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: HttpClient, useValue: httpMock },
        { provide: Router, useValue: routerMock },
        { provide: ErrorHandlerService, useValue: errorHandlerMock },
      ],
    });

    service = TestBed.inject(AuthService);
    const context: AuthContext = {
      user_id: 'user-1',
      email: 'user@example.com',
      first_name: 'Test',
      last_name: 'User',
      must_change_password: false,
      authorized_tenants: [],
      memberships: [
        { tenant_id: 'tenant-1', role: 'MANAGER', is_active: true },
        { tenant_id: 'tenant-2', role: 'ADMIN', is_active: true },
      ],
    };

    (
      service as unknown as { authContextSignal: { set: (ctx: AuthContext) => void } }
    ).authContextSignal.set(context);
  });

  it('returns true when membership meets minimum role requirement', () => {
    expect(service.hasMinimumRole('tenant-1', 'STAFF')).toBeTrue();
    expect(service.hasMinimumRole('tenant-2', 'ADMIN')).toBeTrue();
  });

  it('returns false when membership is missing or insufficient', () => {
    expect(service.hasMinimumRole('tenant-1', 'ADMIN')).toBeFalse();
    expect(service.hasMinimumRole('tenant-unknown', 'ADMIN')).toBeFalse();
  });

  it('returns tenant role for active memberships', () => {
    expect(service.getTenantRole('tenant-1')).toBe('MANAGER');
    expect(service.getTenantRole('tenant-2')).toBe('ADMIN');
    expect(service.getTenantRole('tenant-missing')).toBeNull();
  });
});
