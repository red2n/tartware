import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { of } from 'rxjs';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  const swUpdateStub: Partial<SwUpdate> = {
    isEnabled: false,
    versionUpdates: of(),
    unrecoverable: of(),
    checkForUpdate: jasmine.createSpy('checkForUpdate').and.resolveTo(false),
    activateUpdate: jasmine.createSpy('activateUpdate').and.resolveTo(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: SwUpdate, useValue: swUpdateStub }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'tartware-ui' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('tartware-ui');
  });
});
