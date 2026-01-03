// Firestore services - Main barrel export
// This file re-exports all firestore domain services

// Domain services by collection
export * from './categories';
export * from './companies';
export * from './employees';
export * from './orders';
export * from './customers';
export * from './finance';
export * from './stock';
export * from './products';
export * from './sales';
export * from './expenses';
export * from './matieres';
export * from './suppliers';
export * from './objectives';
export * from './tags';
export * from './customUnits';
export * from './site';

// Legacy exports from main firestore.ts (will be gradually moved to domain services)
export * from './firestore';
