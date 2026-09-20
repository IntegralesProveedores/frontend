import { Component } from '@angular/core';
import {
  BUSINESS_WHATSAPP_URL,
  BUSINESS_PHONE_DISPLAY,
  BUSINESS_PHONE_TEL,
} from '../../../shared/constants/contact.constants';

@Component({
  selector: 'app-contacto-brotalia',
  standalone: true,
  imports: [],
  templateUrl: './contacto-brotalia.component.html',
  styleUrl: './contacto-brotalia.component.css',
})
export class ContactoBrotaliaComponent {
  readonly whatsappUrl = BUSINESS_WHATSAPP_URL;
  readonly phoneDisplay = BUSINESS_PHONE_DISPLAY;
  readonly phoneHref = `tel:${BUSINESS_PHONE_TEL}`;
}
