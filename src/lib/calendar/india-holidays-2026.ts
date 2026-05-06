export type IndiaHolidayCategory = "national" | "festival";

export type IndiaHoliday = {
  id: string;
  name: string;
  dateKey: string;
  category: IndiaHolidayCategory;
  isTentative?: boolean;
};

export const INDIA_HOLIDAYS_2026: IndiaHoliday[] = [
  {
    id: "republic-day",
    name: "Republic Day",
    dateKey: "2026-01-26",
    category: "national",
  },
  {
    id: "holi",
    name: "Holi",
    dateKey: "2026-03-04",
    category: "festival",
  },
  {
    id: "eid-ul-fitr",
    name: "Eid-ul-Fitr",
    dateKey: "2026-03-21",
    category: "festival",
    isTentative: true,
  },
  {
    id: "ram-navami",
    name: "Ram Navami",
    dateKey: "2026-03-26",
    category: "festival",
  },
  {
    id: "mahavir-jayanti",
    name: "Mahavir Jayanti",
    dateKey: "2026-03-31",
    category: "festival",
  },
  {
    id: "good-friday",
    name: "Good Friday",
    dateKey: "2026-04-03",
    category: "festival",
  },
  {
    id: "buddha-purnima",
    name: "Buddha Purnima",
    dateKey: "2026-05-01",
    category: "festival",
  },
  {
    id: "id-ul-zuha",
    name: "Id-ul-Zuha (Bakrid)",
    dateKey: "2026-05-27",
    category: "festival",
    isTentative: true,
  },
  {
    id: "muharram",
    name: "Muharram",
    dateKey: "2026-06-26",
    category: "festival",
    isTentative: true,
  },
  {
    id: "independence-day",
    name: "Independence Day",
    dateKey: "2026-08-15",
    category: "national",
  },
  {
    id: "milad-un-nabi",
    name: "Milad-un-Nabi / Id-e-Milad",
    dateKey: "2026-08-26",
    category: "festival",
    isTentative: true,
  },
  {
    id: "janmashtami",
    name: "Janmashtami (Vaishnava)",
    dateKey: "2026-09-04",
    category: "festival",
  },
  {
    id: "gandhi-jayanti",
    name: "Mahatma Gandhi Jayanti",
    dateKey: "2026-10-02",
    category: "national",
  },
  {
    id: "dussehra",
    name: "Dussehra",
    dateKey: "2026-10-20",
    category: "festival",
  },
  {
    id: "diwali",
    name: "Diwali (Deepavali)",
    dateKey: "2026-11-08",
    category: "festival",
  },
  {
    id: "guru-nanak-jayanti",
    name: "Guru Nanak Jayanti",
    dateKey: "2026-11-24",
    category: "festival",
  },
  {
    id: "christmas",
    name: "Christmas Day",
    dateKey: "2026-12-25",
    category: "festival",
  },
];
