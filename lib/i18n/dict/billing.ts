/**
 * Billing strings: Settings › Billing (AEC-flow's own Stripe subscription, D-5) and
 * the past-due / canceled banner. Every key needs BOTH a Spanish and a Dutch value
 * (lib/i18n/coverage.test.ts); German, Chinese, Japanese and Portuguese live in
 * dict/<lang>/billing.ts (full-coverage.test.ts).
 */
import type { AreaDict } from "../types";

export const billing: AreaDict = {
  es: {
    "Billing":
      "Facturación",
    "Your practice's AEC-flow subscription, paid to Nucleus LLC through Stripe.":
      "La suscripción de su estudio a AEC-flow, pagada a Nucleus LLC a través de Stripe.",
    "Thank you. Stripe is confirming your subscription; this page shows it within a minute.":
      "Gracias. Stripe está confirmando su suscripción; esta página la mostrará en un minuto.",
    "Checkout was cancelled. Nothing was charged.":
      "Se canceló el pago. No se cobró nada.",
    "This is the founder practice. AEC-flow is free for it; there is nothing to pay.":
      "Este es el estudio fundador. AEC-flow es gratuito para él; no hay nada que pagar.",
    "No subscription":
      "Sin suscripción",
    "Trial":
      "Prueba",
    "Payment past due":
      "Pago vencido",
    "Canceled":
      "Cancelada",
    "AEC-flow, yearly":
      "AEC-flow, anual",
    "AEC-flow, monthly":
      "AEC-flow, mensual",
    "Ends on":
      "Termina el",
    "Renews on":
      "Se renueva el",
    "{used} of {limit} in use":
      "{used} de {limit} en uso",
    "The subscription is set to end at the close of this period.":
      "La suscripción terminará al cierre de este período.",
    "The last payment did not go through. Update the card in Manage billing.":
      "El último pago no se realizó. Actualice la tarjeta en Gestionar facturación.",
    "Access is not limited by billing during the beta.":
      "Durante la beta, el acceso no se limita por la facturación.",
    "Only an administrator or director can manage billing.":
      "Solo un administrador o director puede gestionar la facturación.",
    "Subscribe monthly":
      "Suscribirse mensualmente",
    "Subscribe":
      "Suscribirse",
    "Subscribe yearly":
      "Suscribirse anualmente",
    "Manage billing":
      "Gestionar facturación",
    "Your practice's AEC-flow payment is past due.":
      "El pago de AEC-flow de su estudio está vencido.",
    "Your practice's AEC-flow subscription has ended.":
      "La suscripción de su estudio a AEC-flow ha terminado.",
    "Please let an administrator or director know.":
      "Por favor, avise a un administrador o director.",
    "Billing is not available yet.":
      "La facturación aún no está disponible.",
    "Your practice could not be found.":
      "No se encontró su estudio.",
    "Your practice does not pay for AEC-flow.":
      "Su estudio no paga por AEC-flow.",
    "Your practice already has a subscription. Use Manage billing.":
      "Su estudio ya tiene una suscripción. Use Gestionar facturación.",
    "That billing period is not offered.":
      "Ese período de facturación no se ofrece.",
    "Stripe did not return a checkout page. Please try again.":
      "Stripe no devolvió una página de pago. Inténtelo de nuevo.",
    "Stripe could not start the checkout. Please try again.":
      "Stripe no pudo iniciar el pago. Inténtelo de nuevo.",
    "There is no billing account yet. Subscribe first.":
      "Aún no hay una cuenta de facturación. Suscríbase primero.",
    "Stripe could not open the billing portal. Please try again.":
      "Stripe no pudo abrir el portal de facturación. Inténtelo de nuevo.",
  },
  nl: {
    "Billing":
      "Facturering",
    "Your practice's AEC-flow subscription, paid to Nucleus LLC through Stripe.":
      "Het AEC-flow-abonnement van uw bureau, betaald aan Nucleus LLC via Stripe.",
    "Thank you. Stripe is confirming your subscription; this page shows it within a minute.":
      "Dank u. Stripe bevestigt uw abonnement; deze pagina toont het binnen een minuut.",
    "Checkout was cancelled. Nothing was charged.":
      "Het afrekenen is geannuleerd. Er is niets in rekening gebracht.",
    "This is the founder practice. AEC-flow is free for it; there is nothing to pay.":
      "Dit is het oprichtersbureau. AEC-flow is hiervoor gratis; er valt niets te betalen.",
    "No subscription":
      "Geen abonnement",
    "Trial":
      "Proefperiode",
    "Payment past due":
      "Betaling achterstallig",
    "Canceled":
      "Opgezegd",
    "AEC-flow, yearly":
      "AEC-flow, jaarlijks",
    "AEC-flow, monthly":
      "AEC-flow, maandelijks",
    "Ends on":
      "Eindigt op",
    "Renews on":
      "Wordt verlengd op",
    "{used} of {limit} in use":
      "{used} van {limit} in gebruik",
    "The subscription is set to end at the close of this period.":
      "Het abonnement eindigt aan het einde van deze periode.",
    "The last payment did not go through. Update the card in Manage billing.":
      "De laatste betaling is niet gelukt. Werk de kaart bij in Facturering beheren.",
    "Access is not limited by billing during the beta.":
      "Tijdens de bèta wordt de toegang niet beperkt door de facturering.",
    "Only an administrator or director can manage billing.":
      "Alleen een beheerder of directeur kan de facturering beheren.",
    "Subscribe monthly":
      "Maandelijks abonneren",
    "Subscribe":
      "Abonneren",
    "Subscribe yearly":
      "Jaarlijks abonneren",
    "Manage billing":
      "Facturering beheren",
    "Your practice's AEC-flow payment is past due.":
      "De AEC-flow-betaling van uw bureau is achterstallig.",
    "Your practice's AEC-flow subscription has ended.":
      "Het AEC-flow-abonnement van uw bureau is beëindigd.",
    "Please let an administrator or director know.":
      "Laat het een beheerder of directeur weten.",
    "Billing is not available yet.":
      "Facturering is nog niet beschikbaar.",
    "Your practice could not be found.":
      "Uw bureau is niet gevonden.",
    "Your practice does not pay for AEC-flow.":
      "Uw bureau betaalt niet voor AEC-flow.",
    "Your practice already has a subscription. Use Manage billing.":
      "Uw bureau heeft al een abonnement. Gebruik Facturering beheren.",
    "That billing period is not offered.":
      "Die factureringsperiode wordt niet aangeboden.",
    "Stripe did not return a checkout page. Please try again.":
      "Stripe gaf geen betaalpagina terug. Probeer het opnieuw.",
    "Stripe could not start the checkout. Please try again.":
      "Stripe kon het afrekenen niet starten. Probeer het opnieuw.",
    "There is no billing account yet. Subscribe first.":
      "Er is nog geen factureringsaccount. Abonneer eerst.",
    "Stripe could not open the billing portal. Please try again.":
      "Stripe kon het factureringsportaal niet openen. Probeer het opnieuw.",
  },
};
