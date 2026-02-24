/** Shared badge-class helpers for room status and housekeeping status. */

export function roomStatusClass(status: string): string {
  switch (status) {
    case 'setup':
      return 'badge-muted';
    case 'available':
      return 'badge-success';
    case 'occupied':
      return 'badge-accent';
    case 'out_of_order':
    case 'out_of_service':
      return 'badge-danger';
    case 'blocked':
      return 'badge-warning';
    default:
      return '';
  }
}

export function housekeepingStatusClass(status: string): string {
  switch (status) {
    case 'CLEAN':
    case 'INSPECTED':
      return 'badge-success';
    case 'DIRTY':
      return 'badge-danger';
    case 'IN_PROGRESS':
      return 'badge-warning';
    default:
      return '';
  }
}
