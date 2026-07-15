export const environment = {
  production: false,
  apiUrl: 'https://api.brotalia.com.ar',
  // IMPORTANTE: verificar en el dashboard de EmailJS que "Allowed origins"
  // esté restringido a https://brotalia.com.ar (Settings > Security)
  emailjs: {
    serviceId: 'service_q9ivf9b',
    templateId: 'template_imfgs1r',
    publicKey: 'mh-L6Epb_NpRXUkMa'
  }
};
