/**
 * Iterates over each date in [startDate, endDate] (inclusive),
 * calling the callback with the ISO date string (YYYY-MM-DD).
 */
export const forEachDateInRange = async (
  startDateStr: string,
  endDateStr: string,
  callback: (dateStr: string) => Promise<void>,
): Promise<number> => {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  let count = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    await callback(dateStr);
    count++;
  }
  return count;
};
