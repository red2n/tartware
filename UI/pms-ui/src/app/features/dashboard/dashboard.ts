import { Component } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";

@Component({
	selector: "app-dashboard",
	standalone: true,
	imports: [MatCardModule, MatIconModule],
	templateUrl: "./dashboard.html",
	styleUrl: "./dashboard.scss",
})
export class DashboardComponent {}
