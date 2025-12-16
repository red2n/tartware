import { DatabaseError } from "pg";

import type {
  AmenityCatalogRow,
  InsertAmenityInput,
  ListAmenitiesInput,
  UpdateAmenityInput,
} from "../repositories/amenities-repository.js";
import {
  insertAmenity,
  listAmenities,
  updateAmenity,
} from "../repositories/amenities-repository.js";

export class AmenityConflictError extends Error {
  statusCode = 409;
}

export class AmenityNotFoundError extends Error {
  statusCode = 404;
}

const isUniqueViolation = (error: unknown): error is DatabaseError => {
  return error instanceof DatabaseError && error.code === "23505";
};

/**
 * Returns amenity catalog entries for a property and tenant.
 */
export const listAmenityCatalog = async (
  input: ListAmenitiesInput,
): Promise<AmenityCatalogRow[]> => {
  return listAmenities(input);
};

/**
 * Creates a new custom amenity row, propagating uniqueness errors as 409 responses.
 */
export const createAmenity = async (input: InsertAmenityInput): Promise<AmenityCatalogRow> => {
  try {
    return await insertAmenity({
      ...input,
      amenityCode: input.amenityCode.toUpperCase(),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AmenityConflictError(`Amenity ${input.amenityCode} already exists for property`);
    }
    throw error;
  }
};

/**
 * Updates an existing amenity entry and returns the mutated row.
 */
export const modifyAmenity = async (input: UpdateAmenityInput): Promise<AmenityCatalogRow> => {
  const result = await updateAmenity({
    ...input,
    amenityCode: input.amenityCode.toUpperCase(),
  });

  if (result === null) {
    throw new AmenityNotFoundError(
      `Amenity ${input.amenityCode} not found for property ${input.propertyId}`,
    );
  }

  return result;
};
