import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-welcome',
  template: `
    <section class="panel" aria-label="Welcome">
      <h1>System Admin UI</h1>
      <p>Contract-driven shell is ready. Wire login, break-glass, and impersonation next.</p>
    </section>
  `,
  styleUrls: ['./welcome.component.scss'],
})
export class WelcomeComponent {}
