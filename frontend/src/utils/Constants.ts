import { PlanI } from "../interfaces/Plans";

export const plans: Array<PlanI> = [
  {
    id: 123463455142315,
    title: "Membresía Mensual",
    price: "$ 18.00 USD",
    description: "500 GB de descarga vía FTP",
    duration: 30,
    included: [
      "Renovación automática",
      "Busqueda avanzada",
      "Nueva música diariamente",
      "Descargas con 1 click",
      "HQ Audio / HD Video",
    ],
    space: 500,
    priceIdPaypal: "",
    priceIdStripe: "",
  },
  {
    id: 123463455142316,
    title: "Membresía Mensual",
    price: "$ 350.00 MXN",
    description: "500 GB de descarga vía FTP",
    duration: 30,
    included: [
      "Renovación automática",
      "Busqueda avanzada",
      "Nueva música diariamente",
      "Descargas con 1 click",
      "HQ Audio / HD Video",
    ],
    space: 500,
    priceIdPaypal: "",
    priceIdStripe: "",
  },
];
