import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  label: string;
  link?: string;
  /** Página actual. Por defecto: el último elemento si no tiene enlace. */
  current?: boolean;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.css',
})
export class BreadcrumbComponent {
  @Input({ required: true }) items: BreadcrumbItem[] = [];
  @Input() clearLogo = true;

  isCurrent(item: BreadcrumbItem, last: boolean): boolean {
    return item.current ?? (last && !item.link);
  }
}
