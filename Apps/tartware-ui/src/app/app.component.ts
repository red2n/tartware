import { CommonModule } from '@angular/common';
import { Component, inject, type OnInit } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterOutlet } from '@angular/router';
import { StatusBarComponent } from './core/components/status-bar.component';
import { LoadingService } from './core/services/loading.service';
import { PwaService } from './core/services/pwa.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, MatProgressBarModule, StatusBarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'tartware-ui';
  loadingService = inject(LoadingService);
  private pwaService = inject(PwaService);

  ngOnInit(): void {
    // Initialize PWA features
    this.pwaService.initialize();
  }
}
