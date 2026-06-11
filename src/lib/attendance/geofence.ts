import { z } from "zod";

const DEFAULT_ATTENDANCE_RADIUS_METERS = 200;
const EARTH_RADIUS_METERS = 6371000;

export const attendanceLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

export type AttendanceLocationInput = z.infer<typeof attendanceLocationSchema>;

function readCoordinate(value: string | undefined, label: string) {
  if (!value?.trim()) {
    throw new Error(`${label} is not configured.`);
  }

  const coordinate = Number(value);
  if (!Number.isFinite(coordinate)) {
    throw new Error(`${label} is not configured.`);
  }
  return coordinate;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function getAttendanceOfficeGeofence() {
  const latitude = readCoordinate(process.env.ATTENDANCE_OFFICE_LATITUDE, "Office latitude");
  const longitude = readCoordinate(process.env.ATTENDANCE_OFFICE_LONGITUDE, "Office longitude");
  const radiusMeters = Number(process.env.ATTENDANCE_OFFICE_RADIUS_METERS ?? DEFAULT_ATTENDANCE_RADIUS_METERS);

  return {
    latitude,
    longitude,
    radiusMeters: Number.isFinite(radiusMeters) && radiusMeters > 0
      ? radiusMeters
      : DEFAULT_ATTENDANCE_RADIUS_METERS,
  };
}

export function calculateDistanceMeters(
  first: Pick<AttendanceLocationInput, "latitude" | "longitude">,
  second: Pick<AttendanceLocationInput, "latitude" | "longitude">,
) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function assertInsideAttendanceGeofence(location: AttendanceLocationInput) {
  const office = getAttendanceOfficeGeofence();
  const distanceMeters = calculateDistanceMeters(location, office);

  if (distanceMeters > office.radiusMeters) {
    throw new Error(
      `You are ${Math.round(distanceMeters)} m away from office. Check-in/out is allowed only within ${office.radiusMeters} m.`,
    );
  }

  return {
    distanceMeters: Math.round(distanceMeters),
    officeRadiusMeters: office.radiusMeters,
  };
}
