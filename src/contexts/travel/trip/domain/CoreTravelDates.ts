/**
 * Regla de dominio: fechas núcleo de ida/vuelta presentes y en formato calendario ISO.
 */
export class CoreTravelDates {
  static areCompleteIn(gathered: Record<string, string>): boolean {
    const iso = (s: string | undefined): boolean =>
      s !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
    const ob = gathered.outbound ?? gathered.outbound_date;
    const ret = gathered.return ?? gathered.return_date;
    return iso(ob) && iso(ret);
  }
}
