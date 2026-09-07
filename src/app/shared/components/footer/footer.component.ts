import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  BUSINESS_WHATSAPP_URL,
  BUSINESS_PHONE_DISPLAY,
} from '../../constants/contact.constants';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css',
})
export class FooterComponent {
  readonly whatsappUrl = BUSINESS_WHATSAPP_URL;
  readonly phoneDisplay = BUSINESS_PHONE_DISPLAY;
}
