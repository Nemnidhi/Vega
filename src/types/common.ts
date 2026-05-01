export type ObjectId = string;

export type CurrencyCode = "INR" | "USD";

export interface TimestampFields {
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseDocument extends TimestampFields {
  _id: ObjectId;
}

export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";
