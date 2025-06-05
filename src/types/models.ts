export type Timestamp = {
  seconds: number;
  nanoseconds: number;
};

export interface BaseModel {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Category extends BaseModel {
  name: string;
  description?: string;
  createdBy: string;
  productCount?: number;
}

// Rest of the existing interfaces...