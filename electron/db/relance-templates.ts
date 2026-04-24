// Default email bodies for the 3 levels of invoice dunning (relance).
// Professional but firm — escalates from friendly reminder to formal demand.
// Placeholders available: {numero}, {montant_du}, {date_echeance},
// {jours_retard}, {civilite}, {nom}

export const DEFAULT_RELANCE_N1 = `Bonjour,

Sauf erreur de notre part, nous n'avons pas enregistré le règlement de la facture N° {numero} d'un montant de {montant_du}, arrivée à échéance le {date_echeance} ({jours_retard} jours de retard).

Si le règlement est déjà parti, merci de ne pas tenir compte de ce message.

Dans le cas contraire, nous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais.

N'hésitez pas à me contacter pour toute question.

Bien cordialement,`;

export const DEFAULT_RELANCE_N2 = `Bonjour,

Malgré notre précédent rappel, la facture N° {numero} d'un montant de {montant_du}, échue depuis {jours_retard} jours, demeure impayée.

Nous vous demandons de bien vouloir procéder au règlement sous 8 jours.

À défaut, nous nous verrons dans l'obligation d'engager une procédure de recouvrement, avec application des pénalités de retard et de l'indemnité forfaitaire de 40 € pour frais de recouvrement prévues par l'article L.441-10 du Code de commerce.

Nous espérons éviter d'en arriver là et restons à votre écoute pour convenir d'un arrangement si la situation le nécessite.

Bien cordialement,`;

export const DEFAULT_RELANCE_N3 = `Madame, Monsieur,

Par la présente et en l'absence de règlement malgré nos rappels des dernières semaines, nous vous mettons en demeure de procéder sous 8 jours au paiement de la facture N° {numero} d'un montant de {montant_du} TTC, impayée depuis {jours_retard} jours.

À défaut de règlement dans ce délai, nous nous verrons contraints d'engager une procédure contentieuse, sans nouveau préavis, avec :
— application des pénalités de retard au taux légal majoré
— indemnité forfaitaire de 40 € pour frais de recouvrement (art. L.441-10 du Code de commerce)
— frais de procédure et honoraires éventuels à votre charge

Nous restons néanmoins ouverts à un règlement amiable jusqu'à l'expiration du délai mentionné.

Cordialement,`;
