import { query } from "../lib/db.js";

type AvailabilityRange = {
  tenantId: string;
  propertyId: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  context: string;
};

const subtractOneDayUtc = (date: string): string => {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
};

export const refreshAvailabilityWindow = async (
  range: AvailabilityRange,
): Promise<void> => {
  const { checkInDate, checkOutDate } = range;
  if (!checkInDate || !checkOutDate) return;

  const endDate = subtractOneDayUtc(checkOutDate);
  if (new Date(`${endDate}T00:00:00Z`) < new Date(`${checkInDate}T00:00:00Z`)) {
    return;
  }

  await query(
    `
      SELECT refresh_room_availability_window(
        $1::uuid,
        $2::uuid,
        $3::date,
        $4::date,
        $5::uuid,
        $6::text
      );
    `,
    [
      range.propertyId,
      range.roomTypeId,
      checkInDate,
      endDate,
      range.tenantId,
      range.context,
    ],
  );
};
