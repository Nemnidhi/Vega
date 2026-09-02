import { z } from "zod";
import { serializeForJson } from "@/lib/utils/serialize";
import { AttendanceSettingsModel } from "@/models";

const DEFAULT_ATTENDANCE_RADIUS_METERS = 200;
const EARTH_RADIUS_METERS = 6371000;
const ATTENDANCE_SETTINGS_KEY = "default";

export const attendanceLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

export type AttendanceLocationInput = z.infer<typeof attendanceLocationSchema>;

export const attendanceGeofenceSettingsSchema = z.object({
  officeLatitude: z.number().min(-90).max(90),
  officeLongitude: z.number().min(-180).max(180),
  officeRadiusMeters: z.number().int().min(1).max(10000).default(DEFAULT_ATTENDANCE_RADIUS_METERS),
});

export type AttendanceGeofenceSettingsPayload = z.infer<typeof attendanceGeofenceSettingsSchema> & {
  updatedAt?: string;
};

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

export function getEnvAttendanceOfficeGeofence() {
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

function getOptionalEnvAttendanceOfficeGeofence() {
  const latitudeValue = process.env.ATTENDANCE_OFFICE_LATITUDE;
  const longitudeValue = process.env.ATTENDANCE_OFFICE_LONGITUDE;

  if (!latitudeValue?.trim() || !longitudeValue?.trim()) {
    return null;
  }

  return getEnvAttendanceOfficeGeofence();
}

export async function getAttendanceOfficeGeofence() {
  const settings = await AttendanceSettingsModel.findOne({ key: ATTENDANCE_SETTINGS_KEY })
    .select("officeLatitude officeLongitude officeRadiusMeters updatedAt")
    .lean();

  if (
    settings &&
    typeof settings.officeLatitude === "number" &&
    typeof settings.officeLongitude === "number"
  ) {
    return {
      latitude: settings.officeLatitude,
      longitude: settings.officeLongitude,
      radiusMeters:
        typeof settings.officeRadiusMeters === "number" && settings.officeRadiusMeters > 0
          ? settings.officeRadiusMeters
          : DEFAULT_ATTENDANCE_RADIUS_METERS,
    };
  }

  const envGeofence = getOptionalEnvAttendanceOfficeGeofence();
  if (envGeofence) {
    return envGeofence;
  }

  throw new Error("Office latitude is not configured.");
}

export async function getAttendanceGeofenceSettings() {
  const settings = await AttendanceSettingsModel.findOne({ key: ATTENDANCE_SETTINGS_KEY })
    .select("officeLatitude officeLongitude officeRadiusMeters updatedAt")
    .lean();

  if (
    settings &&
    typeof settings.officeLatitude === "number" &&
    typeof settings.officeLongitude === "number"
  ) {
    return serializeForJson({
      officeLatitude: settings.officeLatitude,
      officeLongitude: settings.officeLongitude,
      officeRadiusMeters: settings.officeRadiusMeters ?? DEFAULT_ATTENDANCE_RADIUS_METERS,
      updatedAt: settings.updatedAt,
    }) as AttendanceGeofenceSettingsPayload;
  }

  const envGeofence = getOptionalEnvAttendanceOfficeGeofence();
  if (!envGeofence) {
    return null;
  }

  return {
    officeLatitude: envGeofence.latitude,
    officeLongitude: envGeofence.longitude,
    officeRadiusMeters: envGeofence.radiusMeters,
  } satisfies AttendanceGeofenceSettingsPayload;
}

export async function saveAttendanceGeofenceSettings(
  settings: AttendanceGeofenceSettingsPayload,
  updatedByUserId: string,
) {
  const saved = await AttendanceSettingsModel.findOneAndUpdate(
    { key: ATTENDANCE_SETTINGS_KEY },
    {
      $set: {
        key: ATTENDANCE_SETTINGS_KEY,
        officeLatitude: settings.officeLatitude,
        officeLongitude: settings.officeLongitude,
        officeRadiusMeters: settings.officeRadiusMeters,
        updatedByUserId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
    .select("officeLatitude officeLongitude officeRadiusMeters updatedAt")
    .lean();

  return serializeForJson({
    officeLatitude: saved.officeLatitude,
    officeLongitude: saved.officeLongitude,
    officeRadiusMeters: saved.officeRadiusMeters ?? DEFAULT_ATTENDANCE_RADIUS_METERS,
    updatedAt: saved.updatedAt,
  }) as AttendanceGeofenceSettingsPayload;
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

export async function assertInsideAttendanceGeofence(location: AttendanceLocationInput) {
  const office = await getAttendanceOfficeGeofence();
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
